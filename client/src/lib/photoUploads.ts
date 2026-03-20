type SignedUploadResponse = {
  uploadUrl: string;
  fileKey: string;
};

type UploadCompleteResponse = {
  fileKey: string;
  fileUrl: string;
};

function uploadViaSignedUrl(
  file: File,
  uploadUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export async function uploadPhotoFile(
  file: File,
  uploadType: "assets" | "inspection-images" = "inspection-images",
  onProgress?: (percent: number) => void
): Promise<UploadCompleteResponse> {
  const signResponse = await fetch("/api/uploads/signed-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadType,
    }),
  });

  if (!signResponse.ok) {
    const message = await signResponse.text();
    throw new Error(`Failed to request upload URL: ${message}`);
  }

  const { uploadUrl, fileKey } = (await signResponse.json()) as SignedUploadResponse;
  await uploadViaSignedUrl(file, uploadUrl, onProgress);

  const completeResponse = await fetch("/api/uploads/complete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileKey,
      fileType: file.type,
      uploadType,
    }),
  });

  if (!completeResponse.ok) {
    const message = await completeResponse.text();
    throw new Error(`Upload completion failed: ${message}`);
  }

  const payload = (await completeResponse.json()) as UploadCompleteResponse;
  if (!payload.fileUrl) {
    throw new Error("Upload succeeded but no public file URL was returned");
  }
  return payload;
}
