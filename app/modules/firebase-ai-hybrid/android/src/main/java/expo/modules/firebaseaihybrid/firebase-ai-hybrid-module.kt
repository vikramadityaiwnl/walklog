package expo.modules.firebaseaihybrid

import com.google.firebase.FirebaseApp
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.type.PublicPreviewAPI
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

    AsyncFunction("generateText") Coroutine { prompt: String, mode: String ->
      require(prompt.isNotBlank()) { "Enter a prompt first." }
      val inferenceMode = when (mode) {
        "auto" -> InferenceMode.PREFER_ON_DEVICE
        "device" -> InferenceMode.ONLY_ON_DEVICE
        "cloud" -> InferenceMode.ONLY_IN_CLOUD
        else -> throw IllegalArgumentException("Unknown inference mode: $mode")
      }
      val response = model(inferenceMode).generateContent(prompt)
      val source = when (response.inferenceSource) {
        InferenceSource.ON_DEVICE -> "on-device"
        InferenceSource.IN_CLOUD -> "cloud"
        else -> "unknown"
      }
      mapOf("text" to (response.text ?: ""), "source" to source)
    }
  }
}
