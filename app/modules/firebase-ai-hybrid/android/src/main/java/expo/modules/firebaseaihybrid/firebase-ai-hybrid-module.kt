package expo.modules.firebaseaihybrid

import com.google.firebase.FirebaseApp
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.content
import android.net.Uri
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.flow.collect

@OptIn(PublicPreviewAPI::class)
class FirebaseAiHybridModule : Module() {
  private fun model(mode: InferenceMode = InferenceMode.PREFER_ON_DEVICE) = FirebaseAI.getInstance(FirebaseApp.getInstance()).generativeModel(
    "gemini-3.1-flash-lite",
    onDeviceConfig = OnDeviceConfig(mode = mode),
  )

  override fun definition() = ModuleDefinition {
    Name("FirebaseAiHybrid")

    AsyncFunction("generateTextWithImages") Coroutine { prompt: String, uris: List<String> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application unavailable.")
      var totalSize = 0
      val images = uris.map { uri ->
        val parsed = Uri.parse(uri)
        require(parsed.scheme == "file" || parsed.scheme == "content") { "Invalid image file." }
        context.contentResolver.openInputStream(parsed)?.use { stream ->
          val output = ByteArrayOutputStream()
          val buffer = ByteArray(8192)
          var count = stream.read(buffer)
          while (count != -1) {
            totalSize += count
            require(totalSize <= 14_000_000) { "The photos are too large to process together." }
            output.write(buffer, 0, count)
            count = stream.read(buffer)
          }
          output.toByteArray()
        } ?: throw IllegalStateException("Couldn’t open an image.")
      }
      val response = model(InferenceMode.ONLY_IN_CLOUD).generateContent(content {
        text(prompt)
        images.forEach { inlineData(it, "image/jpeg") }
      })
      mapOf("text" to (response.text ?: ""), "source" to "cloud")
    }

    AsyncFunction("checkAvailability") Coroutine { ->
      val status = model().onDeviceExtension?.checkStatus()
      val name = when (status) {
        OnDeviceModelStatus.AVAILABLE -> "available"
        OnDeviceModelStatus.DOWNLOADABLE -> "downloadable"
        OnDeviceModelStatus.DOWNLOADING -> "downloading"
        else -> "unavailable"
      }
      mapOf(
        "status" to name,
        "message" to when (name) {
          "available" -> "The on-device model is ready."
          "downloadable" -> "The on-device model is available to download."
          "downloading" -> "The on-device model is downloading."
          else -> "The on-device model is unavailable on this device."
        },
      )
    }

    AsyncFunction("downloadModel") Coroutine { ->
      val extension = model().onDeviceExtension
        ?: throw IllegalStateException("On-device AI is unavailable.")
      extension.download().collect { }
      if (extension.checkStatus() != OnDeviceModelStatus.AVAILABLE) {
        throw IllegalStateException("The on-device model is not ready. Check availability and try again.")
      }
    }

    AsyncFunction("generateText") Coroutine { prompt: String, mode: String, audioUri: String?, mimeType: String? ->
      require(prompt.isNotBlank()) { "Enter a prompt first." }
      require(audioUri == null || (mimeType != null && (mode == "cloud" || (mode == "device" && mimeType.startsWith("image/"))))) { "This input requires cloud processing and a MIME type." }
      val inferenceMode = when (mode) {
        "auto" -> InferenceMode.PREFER_ON_DEVICE
        "device" -> InferenceMode.ONLY_ON_DEVICE
        "cloud" -> InferenceMode.ONLY_IN_CLOUD
        else -> throw IllegalArgumentException("Unknown inference mode: $mode")
      }
      val response = if (audioUri != null && mimeType != null) {
        val context = appContext.reactContext ?: throw IllegalStateException("Application unavailable.")
        val parsed = Uri.parse(audioUri)
        require(parsed.scheme == "file" || parsed.scheme == "content") { "Invalid audio file." }
        val bytes = context.contentResolver.openInputStream(parsed)?.use { stream ->
          val output = ByteArrayOutputStream()
          val buffer = ByteArray(8192)
          var count = stream.read(buffer)
          while (count != -1) {
            require(output.size() + count <= 14_000_000) { "This recording is too large to process. Try a shorter recording." }
            output.write(buffer, 0, count)
            count = stream.read(buffer)
          }
          output.toByteArray()
        } ?: throw IllegalStateException("Couldn’t open the audio file.")
        if (mode == "device" && mimeType.startsWith("image/")) {
          val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            ?: throw IllegalArgumentException("Couldn’t open the image.")
          model(inferenceMode).generateContent(content {
            image(bitmap)
            text(prompt)
          })
        } else {
          model(inferenceMode).generateContent(content {
            inlineData(bytes, mimeType)
            text(prompt)
          })
        }
      } else {
        model(inferenceMode).generateContent(prompt)
      }
      val source = when (response.inferenceSource) {
        InferenceSource.ON_DEVICE -> "on-device"
        InferenceSource.IN_CLOUD -> "cloud"
        else -> "unknown"
      }
      mapOf("text" to (response.text ?: ""), "source" to source)
    }
  }
}
