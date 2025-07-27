// src/Upload.js
import React, { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const ACCEPTED_FORMATS = ["image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"];

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [folderMode, setFolderMode] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false); // Add this line
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const handleChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => ACCEPTED_FORMATS.includes(file.type) || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    );
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: {
          //"Content-Type": "multipart/form-data",
        },
      });
      console.log("Upload success:", response.data);
      setUploadSuccess(true); // Set success to true
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadSuccess(false); // Set success to false on error
    }
  };

  // When folderMode changes, reset the file input
  React.useEffect(() => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }, [folderMode]);

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      fontWeight: 400,
      letterSpacing: 0.1,
    }}>
      <div style={{
        background: '#fff',
        padding: '40px 36px',
        borderRadius: '18px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        minWidth: 340,
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        fontSize: '18px',
        fontFamily: 'inherit',
      }}>
        <h2 style={{ fontWeight: 500, marginBottom: 28, fontFamily: 'inherit', letterSpacing: 0.2 }}>Upload Photos</h2>
        <input
          ref={fileInputRef}
          type="file"
          multiple={true}
          onChange={handleChange}
          style={{ marginBottom: 18, fontSize: '16px', fontFamily: 'inherit' }}
          {...(folderMode ? { webkitdirectory: "" } : {})}
        />
        <br />
        <button onClick={handleUpload} style={{ fontSize: '16px', padding: '10px 28px', borderRadius: 8, marginBottom: 10, fontFamily: 'inherit' }}>Upload</button>
        {uploadSuccess && (
          <div style={{ color: 'green', fontSize: '15px', marginTop: '10px', fontWeight: 500, fontFamily: 'inherit' }}>Upload success</div>
        )}
        <br />
        <label style={{fontSize: '16px', marginTop: '16px', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={folderMode}
            onChange={() => setFolderMode((prev) => !prev)}
            style={{ marginRight: '8px' }}
          />
          Folder mode
        </label>
      </div>
    </div>
  );
};

export default Upload;