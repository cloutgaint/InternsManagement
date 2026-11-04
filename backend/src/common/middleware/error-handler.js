export function errorHandler(err, req, res, next) {
  if (!err?.status) console.error(err);

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

  // Malformed ids/dates and missing references are client errors, not server faults.
  if (err?.code === "22P02" || err?.code === "22007" || err?.code === "22008")
    return res.status(400).json({ error: "Invalid identifier or date in request" });
  if (err?.code === "23503")
    return res.status(400).json({ error: "A referenced record does not exist" });
  if (err?.code === "23505")
    return res.status(409).json({ error: "This record already exists" });

  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Internal server error" });
}
