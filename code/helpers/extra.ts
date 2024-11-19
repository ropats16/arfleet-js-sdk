export function downloadUint8ArrayAsFile(data: Uint8Array, fileName: string, mimeType: string = 'application/octet-stream') {
  // Create a Blob from the Uint8Array
  const blob = new Blob([data], { type: mimeType });

  // Generate a URL for the Blob
  const url = window.URL.createObjectURL(blob);

  // Create a temporary anchor element
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;

  // Append the anchor to the body (required for Firefox)
  document.body.appendChild(link);

  // Trigger a click on the anchor element
  link.click();

  // Clean up
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}