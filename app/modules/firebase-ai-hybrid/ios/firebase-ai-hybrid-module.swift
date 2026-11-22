import ExpoModulesCore
import FirebaseAILogic
import FirebaseCore

public class FirebaseAiHybridModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FirebaseAiHybrid")
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
            let response = try await ai.generativeModelSession(
              model: FirebaseAI.SystemLanguageModel.default
            ).respond(to: prompt)

            return ["text": response.content, "source": "on-device"]
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
