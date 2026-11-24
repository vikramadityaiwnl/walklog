package expo.modules.walklogfiles

import android.database.Cursor
import android.database.MatrixCursor
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract.Document
import android.provider.DocumentsContract.Root
import android.provider.DocumentsProvider
import android.webkit.MimeTypeMap
import java.io.File
import java.io.FileNotFoundException

class WalklogDocumentsProvider : DocumentsProvider() {
  private val rootColumns = arrayOf(
    Root.COLUMN_ROOT_ID,
    Root.COLUMN_DOCUMENT_ID,
    Root.COLUMN_TITLE,
    Root.COLUMN_FLAGS,
    Root.COLUMN_MIME_TYPES,
  )
  private val documentColumns = arrayOf(
    Document.COLUMN_DOCUMENT_ID,
    Document.COLUMN_DISPLAY_NAME,
    Document.COLUMN_MIME_TYPE,
    Document.COLUMN_FLAGS,
    Document.COLUMN_SIZE,
    Document.COLUMN_LAST_MODIFIED,
  )
  private val groups = listOf("audio", "frames", "photos")
  private val legacyAudioName = Regex("walklog(?:-audio)?-\\d.*", RegexOption.IGNORE_CASE)

  override fun onCreate() = true

  override fun queryRoots(projection: Array<out String>?): Cursor {
    val cursor = MatrixCursor(projection ?: rootColumns)
    cursor.newRow().apply {
      add(Root.COLUMN_ROOT_ID, "walklog")
      add(Root.COLUMN_DOCUMENT_ID, "root")
      add(Root.COLUMN_TITLE, "walklog")
      add(Root.COLUMN_FLAGS, Root.FLAG_LOCAL_ONLY)
      add(Root.COLUMN_MIME_TYPES, "*/*")
    }

    return cursor
  }

  override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor {
    val cursor = MatrixCursor(projection ?: documentColumns)
    addDocument(cursor, documentId)

    return cursor
  }

  override fun queryChildDocuments(
    parentDocumentId: String,
    projection: Array<out String>?,
    sortOrder: String?,
  ): Cursor {
    val cursor = MatrixCursor(projection ?: documentColumns)
    when (parentDocumentId) {
      "root" -> groups.forEach { addDocument(cursor, it) }
      "audio" -> {
        files("audio-current").forEach { addDocument(cursor, "audio-current/${it.name}") }
        files("audio-legacy")
          .filter { it.name.matches(legacyAudioName) }
          .forEach { addDocument(cursor, "audio-legacy/${it.name}") }
      }
      "frames", "photos" -> files(parentDocumentId)
        .forEach { addDocument(cursor, "$parentDocumentId/${it.name}") }
      else -> throw FileNotFoundException("Unknown folder")
    }

    return cursor
  }

  override fun isChildDocument(parentDocumentId: String, documentId: String): Boolean {
    val group = documentId.substringBefore('/')
    if (parentDocumentId == "root")
      return documentId in groups || group in listOf("audio-current", "audio-legacy", "frames", "photos")

    if (parentDocumentId == "audio") return group in listOf("audio-current", "audio-legacy")

    return parentDocumentId in listOf("frames", "photos") && documentId.startsWith("$parentDocumentId/")
  }

  override fun openDocument(
    documentId: String,
    mode: String,
    signal: CancellationSignal?,
  ): ParcelFileDescriptor {
    if (mode != "r") throw FileNotFoundException("Read-only file")

    return ParcelFileDescriptor.open(resolve(documentId), ParcelFileDescriptor.MODE_READ_ONLY)
  }

  private fun files(group: String): List<File> =
    directory(group).listFiles()?.filter { it.isFile }?.sortedBy { it.name } ?: emptyList()

  private fun directory(group: String): File {
    val root = requireNotNull(context).filesDir

    return when (group) {
      "audio-current" -> File(root, "walklog/audio")
      "audio-legacy" -> root
      "frames" -> File(root, "walklog/frames")
      "photos" -> File(root, "walkthrough-photos")
      else -> throw FileNotFoundException("Unknown folder")
    }
  }

  private fun resolve(id: String): File {
    val group = id.substringBefore('/')
    val name = id.substringAfter('/', "")
    if (name.isEmpty() || name.contains('/') || name == "." || name == "..")
      throw FileNotFoundException("Invalid file")

    if (group == "audio-legacy" && !name.matches(legacyAudioName))
      throw FileNotFoundException("Invalid file")

    val base = directory(group).canonicalFile
    val file = File(base, name).canonicalFile
    if (file.parentFile != base || !file.isFile) throw FileNotFoundException("File unavailable")

    return file
  }

  private fun addDocument(cursor: MatrixCursor, id: String) {
    val virtual = id == "root" || id in groups
    val file = if (virtual) null else resolve(id)
    val title = when (id) {
      "root" -> "walklog"
      "audio" -> "Audio"
      "frames" -> "Video frames"
      "photos" -> "Photos"
      else -> requireNotNull(file).name
    }
    val mime = if (virtual) Document.MIME_TYPE_DIR else
      MimeTypeMap.getSingleton().getMimeTypeFromExtension(file!!.extension.lowercase()) ?: "application/octet-stream"

    cursor.newRow().apply {
      add(Document.COLUMN_DOCUMENT_ID, id)
      add(Document.COLUMN_DISPLAY_NAME, title)
      add(Document.COLUMN_MIME_TYPE, mime)
      add(Document.COLUMN_FLAGS, 0)
      if (file != null) {
        add(Document.COLUMN_SIZE, file.length())
        add(Document.COLUMN_LAST_MODIFIED, file.lastModified())
      }
    }
  }
}
