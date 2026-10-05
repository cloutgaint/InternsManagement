export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      const label = err.field === "photo" ? "Photo" : "File";
      return res.status(413).json({
        error: `${label} upload failed: File is too large. Maximum allowed size is 5 MB.`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error:
          "Too many files uploaded. Upload up to 2 proof files and 1 optional photo.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error:
          "Unexpected upload field or too many files. Upload up to 2 proof files and 1 optional photo.",
      });
    }
    return res.status(400).json({ error: `Upload failed: ${err.message}` });
  }

  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Internal server error" });
}
