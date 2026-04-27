// Build a browser Blob from recorded MediaRecorder chunks.
export async function blobFromAudioChunks(chunks, mimeType = 'audio/webm') {
  return new Blob(chunks, { type: mimeType })
}
