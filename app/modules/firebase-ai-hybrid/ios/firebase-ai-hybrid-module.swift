import AVFoundation
import ExpoModulesCore
import FirebaseAILogic
import FirebaseCore
import UIKit
import UniformTypeIdentifiers

public class FirebaseAiHybridModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FirebaseAiHybrid")

    AsyncFunction("isVideoCameraAvailable") { () -> Bool in
      guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return false }

      return UIImagePickerController.availableMediaTypes(for: .camera)?.contains(UTType.movie.identifier) == true
    }.runOnQueue(DispatchQueue.main)

    AsyncFunction("videoDuration") { (uri: String) async throws -> Double in
      guard let url = URL(string: uri), url.isFileURL else {
        throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t open this video."])
      }

      let duration = try await AVURLAsset(url: url).load(.duration).seconds
      guard duration.isFinite && duration > 0 else {
        throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t read the video duration."])
      }

      return duration
    }

    AsyncFunction("exportVideoChunk") { (uri: String, start: Double, end: Double) async throws -> String in
      guard let url = URL(string: uri), url.isFileURL, start >= 0, end > start else {
        throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t open this video."])
      }

      let asset = AVURLAsset(url: url)
      guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
        throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t prepare this video."])
      }

      let output = FileManager.default.temporaryDirectory.appendingPathComponent("walklog-video-\(UUID().uuidString).mp4")
      exporter.outputURL = output
      exporter.outputFileType = .mp4
      exporter.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), end: CMTime(seconds: end, preferredTimescale: 600))
      exporter.shouldOptimizeForNetworkUse = true

      await exporter.export()
      guard exporter.status == .completed else {
        try? FileManager.default.removeItem(at: output)
        throw exporter.error ?? NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t prepare this video."])
      }

      return output.absoluteString
    }

    AsyncFunction("generateTextWithImages") { (prompt: String, uris: [String]) async throws -> [String: String] in
      var parts: [any Part] = [TextPart(prompt)]
      var totalSize = 0
      for uri in uris {
        guard let url = URL(string: uri), url.isFileURL else {
          throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid image file."])
        }
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        guard let size = attributes[.size] as? NSNumber else {
          throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Couldn’t read an image."])
        }
        totalSize += size.intValue
        guard totalSize <= 14_000_000 else {
          throw NSError(domain: "FirebaseAiHybrid", code: 6, userInfo: [NSLocalizedDescriptionKey: "The photos are too large to process together."])
        }
        parts.append(InlineDataPart(data: try Data(contentsOf: url), mimeType: "image/jpeg"))
      }
      let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(modelName: "gemini-3.1-flash-lite")
      let response = try await model.generateContent([ModelContent(parts: parts)])
      return ["text": response.text ?? "", "source": "cloud"]
    }

    AsyncFunction("checkAvailability") { () -> [String: Any] in
      guard #available(iOS 26.0, *) else {
        return ["status": "unavailable", "message": "On-device AI requires iOS 26 or later."]
      }

      switch FirebaseAI.SystemLanguageModel.default.availability {
      case .available:
        return ["status": "available", "message": "Apple's on-device model is ready."]
      case .unavailable(.appleIntelligenceNotEnabled):
        return [
          "status": "unavailable",
          "message": "Enable Apple Intelligence in Settings to use on-device AI.",
        ]
      case .unavailable(.deviceNotEligible):
        return [
          "status": "unavailable", "message": "This device does not support Apple Intelligence.",
        ]
      case .unavailable(.modelNotReady):
        return ["status": "unavailable", "message": "Apple Intelligence is preparing the model."]
      default:
        return [
          "status": "unavailable", "message": "The on-device model is unavailable right now.",
        ]
      }
    }

    AsyncFunction("generateText") {
      (prompt: String, mode: String, audioUri: String?, mimeType: String?) async throws -> [String: String] in
      guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw NSError(
          domain: "FirebaseAiHybrid", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Enter a prompt first."])
      }

      guard ["auto", "device", "cloud"].contains(mode) else {
        throw NSError(
          domain: "FirebaseAiHybrid", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Unknown inference mode."])
      }

      guard audioUri == nil || (mode == "cloud" && mimeType != nil) else {
        throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Audio input requires cloud processing and a MIME type."])
      }

      do {
        let ai = FirebaseAI.firebaseAI(backend: .googleAI())

        if mode == "cloud" {
          let model = ai.generativeModel(modelName: "gemini-3.1-flash-lite")
          let response: GenerateContentResponse
          if let audioUri, let mimeType {
            guard let url = URL(string: audioUri), url.isFileURL else {
              throw NSError(domain: "FirebaseAiHybrid", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid audio file."])
            }
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            guard let size = attributes[.size] as? NSNumber, size.intValue <= 14_000_000 else {
              throw NSError(domain: "FirebaseAiHybrid", code: 6, userInfo: [NSLocalizedDescriptionKey: "This recording is too large to process. Try a shorter recording."])
            }
            response = try await model.generateContent(InlineDataPart(data: Data(contentsOf: url), mimeType: mimeType), prompt)
          } else {
            response = try await model.generateContent(prompt)
          }

          return ["text": response.text ?? "", "source": "cloud"]
        }

        if #available(iOS 26.0, *) {
          if mode == "device" {
            for attempt in 0...2 {
              do {
                let response = try await ai.generativeModelSession(
                  model: FirebaseAI.SystemLanguageModel.default
                ).respond(to: prompt)
                return ["text": response.content, "source": "on-device"]
              } catch {
                guard attempt < 2 && Self.isTransientSafetyAssetError(error) else { throw error }
                try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_000_000_000)
              }
            }
            throw NSError(domain: "FirebaseAiHybrid", code: 2)
          }

          let cloud = ai.geminiModel(name: "gemini-3.1-flash-lite")
          let model = HybridModel(primary: FirebaseAI.SystemLanguageModel.default, secondary: cloud)
          let response = try await ai.generativeModelSession(model: model).respond(to: prompt)
          let version = response.rawResponse.modelVersion
          let source: String
          if version == "apple-foundation-models-system-language-model" {
            source = "on-device"
          } else if version.lowercased().hasPrefix("gemini") {
            source = "cloud"
          } else {
            source = "unknown"
          }

          return ["text": response.content, "source": source]
        }

        if mode == "device" {
          throw NSError(
            domain: "FirebaseAiHybrid", code: 4,
            userInfo: [NSLocalizedDescriptionKey: "On-device AI requires iOS 26 or later."])
        }

        let response = try await ai.generativeModel(modelName: "gemini-3.1-flash-lite")
          .generateContent(prompt)

        return ["text": response.text ?? "", "source": "cloud"]
      } catch {
        throw NSError(
          domain: "FirebaseAiHybrid", code: 2,
          userInfo: [NSLocalizedDescriptionKey: Self.describe(error)])
      }
    }
  }

  private static func isTransientSafetyAssetError(_ error: Error) -> Bool {
    if let generation = error as? GenerateContentError {
      switch generation {
      case .internalError(let underlying): return isTransientSafetyAssetError(underlying)
      default: break
      }
    }
    let details = error as NSError
    if details.domain == "com.apple.SensitiveContentAnalysisML" && details.code == 15 { return true }
    if let underlying = details.userInfo[NSUnderlyingErrorKey] as? Error,
      isTransientSafetyAssetError(underlying) { return true }
    let description = details.localizedDescription
    return description.contains("com.apple.SensitiveContentAnalysisML error 15")
  }

  private static func describe(_ error: Error) -> String {
    if let generation = error as? GenerateContentError {
      switch generation {
      case .internalError(let underlying):
        return "Firebase AI internal error: " + describe(underlying)
      case .promptImageContentError(let underlying):
        return "Firebase AI input error: " + describe(underlying)
      case .promptBlocked: return "Firebase AI blocked the prompt."
      case .responseStoppedEarly(let reason, _):
        return "Firebase AI stopped the response: \(reason)."
      @unknown default: break
      }
    }

    let details = error as NSError

    return
      "\(String(reflecting: type(of: error))) [\(details.domain):\(details.code)]: \(details.localizedDescription)"
  }
}
