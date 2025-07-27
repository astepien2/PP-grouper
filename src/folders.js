import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalContentStyle = {
  background: '#fff',
  padding: '30px',
  borderRadius: '10px',
  maxHeight: '80vh',
  overflowY: 'auto',
  minWidth: '350px',
  minHeight: '200px',
  boxShadow: '0 2px 16px rgba(0,0,0,0.3)'
};

const Folders = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [images, setImages] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [groupedFolders, setGroupedFolders] = useState([]);
  const [deleting, setDeleting] = useState("");
  const [carouselMode, setCarouselMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [metadata, setMetadata] = useState({});
  const [showRankingPicker, setShowRankingPicker] = useState({}); // { [img]: boolean }
  const [groupNames, setGroupNames] = useState({});
  const [editingGroupName, setEditingGroupName] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    // Fetch grouped folders on mount
    axios.get("http://127.0.0.1:8000/grouped_photos").then(res => {
      setGroupedFolders(res.data.groups || []);
    });
    // Fetch metadata for rankings
    axios.get("http://127.0.0.1:8000/uploads/metadata.json").then(res => {
      setMetadata(res.data || {});
    });
    // Fetch group names
    axios.get("http://127.0.0.1:8000/group_names").then(res => {
      setGroupNames(res.data || {});
    });
  }, []);

  const isJpeg = (filename) => filename.toLowerCase().endsWith('.jpeg') || filename.toLowerCase().endsWith('.jpg');

  const handleFolderClick = async () => {
    setModalTitle("Uploads");
    try {
      const res = await axios.get("http://127.0.0.1:8000/list_uploads");
      setImages(res.data.files.filter(isJpeg));
    } catch (err) {
      setImages([]);
    }
    setShowModal(true);
  };

  const handleGroupClick = (groupIdx) => {
    setModalTitle(`Group ${groupIdx + 1}`);
    setImages(groupedFolders[groupIdx].map(photo => photo.filename));
    setShowModal(true);
    setCarouselMode(false);
    setCarouselIndex(0);
    setEditingGroupName(null);
    setNewGroupName(groupNames[groupIdx] || "");
  };

  const handleDelete = async (img) => {
    setDeleting(img);
    try {
      await axios.delete(`http://127.0.0.1:8000/delete_upload`, { params: { filename: img } });
      setImages((prev) => prev.filter((f) => f !== img));
      // Remove empty groups and their names
      setGroupedFolders(prev => {
        const updated = prev.map(group => group.filter(photo => photo.filename !== img));
        const filtered = [];
        const newNames = {};
        let j = 0;
        updated.forEach((group, i) => {
          if (group.length > 0) {
            filtered.push(group);
            if (groupNames[i] !== undefined) newNames[j] = groupNames[i];
            j++;
          }
        });
        setGroupNames(newNames);
        return filtered;
      });
    } catch (err) {
      alert("Failed to delete " + img);
    }
    setDeleting("");
  };

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to delete all rejected (❌) photos in this folder?')) return;
    const toDelete = images.filter(img => metadata[img]?.ranking === 0);
    for (const img of toDelete) {
      try {
        await axios.delete(`http://127.0.0.1:8000/delete_upload`, { params: { filename: img } });
      } catch (err) {
        // Optionally handle error
      }
    }
    setImages((prev) => prev.filter((img) => metadata[img]?.ranking !== 0));
    // Remove empty groups and their names
    setGroupedFolders(prev => {
      const updated = prev.map(group => group.filter(photo => metadata[photo.filename]?.ranking !== 0));
      const filtered = [];
      const newNames = {};
      let j = 0;
      updated.forEach((group, i) => {
        if (group.length > 0) {
          filtered.push(group);
          if (groupNames[i] !== undefined) newNames[j] = groupNames[i];
          j++;
        }
      });
      setGroupNames(newNames);
      return filtered;
    });
  };

  const handleUploadsCleanup = async () => {
    if (!window.confirm('Are you sure you want to delete all rejected (❌) photos in the Uploads folder?')) return;
    const toDelete = images.filter(img => metadata[img]?.ranking === 0);
    for (const img of toDelete) {
      try {
        await axios.delete(`http://127.0.0.1:8000/delete_upload`, { params: { filename: img } });
      } catch (err) {
        // Optionally handle error
      }
    }
    setImages((prev) => prev.filter((img) => metadata[img]?.ranking !== 0));
  };

  const closeModal = () => setShowModal(false);

  const openCarousel = () => {
    setCarouselMode(true);
    setCarouselIndex(0);
  };
  const closeCarousel = () => setCarouselMode(false);
  const prevPhoto = () => setCarouselIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const nextPhoto = () => setCarouselIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  const openCarouselAt = (idx) => {
    setCarouselMode(true);
    setCarouselIndex(idx);
  };

  const updateRanking = async (img, newRanking) => {
    try {
      await axios.post("http://127.0.0.1:8000/update_ranking", { filename: img, ranking: newRanking });
      setMetadata((prev) => ({ ...prev, [img]: { ...prev[img], ranking: newRanking } }));
      setShowRankingPicker((prev) => ({ ...prev, [img]: false }));
    } catch (err) {
      alert("Failed to update ranking");
    }
  };

  const getRankingIcon = (img, interactive = false) => {
    const ranking = metadata[img]?.ranking;
    let icon, color, label;
    if (ranking === 0) { icon = '❌'; color = 'red'; label = 'Reject'; }
    else if (ranking === 2) { icon = '💗'; color = 'hotpink'; label = 'Favorite'; }
    else { icon = '—'; color = 'goldenrod'; label = 'Neutral'; }
    return (
      <span
        style={{ color, fontSize: 22, cursor: interactive ? 'pointer' : 'default' }}
        title={label}
        onClick={interactive ? (e) => { e.stopPropagation(); setShowRankingPicker((prev) => ({ ...prev, [img]: !prev[img] })); } : undefined}
      >{icon}</span>
    );
  };

  const saveGroupName = async (groupIdx) => {
    try {
      await axios.post("http://127.0.0.1:8000/set_group_name", { group_idx: groupIdx, name: newGroupName });
      setGroupNames((prev) => ({ ...prev, [groupIdx]: newGroupName }));
      setEditingGroupName(null);
    } catch (err) {
      alert("Failed to save group name");
    }
  };

  return (
    <div>
      <h2>Fire Folders 🔥</h2>
      
      <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '20px',
            border: '2px solid #888',
            borderRadius: '8px',
            cursor: 'pointer',
            background: '#f5f5f5',
            fontWeight: 'bold',
            fontSize: '18px',
            marginBottom: '10px',
            width: 'fit-content'
          }}
          onClick={handleFolderClick}
        >
          📁 Uploads
        </div>
        {groupedFolders.map((group, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-block',
              padding: '20px',
              border: '2px solid #888',
              borderRadius: '8px',
              cursor: 'pointer',
              background: '#e5f5ff',
              fontWeight: 'bold',
              fontSize: '18px',
              marginBottom: '10px',
              width: 'fit-content'
            }}
            onClick={() => handleGroupClick(idx)}
          >
            📁 {groupNames[idx] ? groupNames[idx] : `Group ${idx + 1}`} ({group.length} photos)
            <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
              {group[0]?.date_taken} - {group[group.length - 1]?.date_taken}
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div style={modalStyle} onClick={closeModal}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <button style={{ float: 'right', fontSize: '18px', marginBottom: '10px' }} onClick={closeModal}>&times; Close</button>
            <h3>{modalTitle.startsWith('Group') && images.length > 0 ? (groupNames[parseInt(modalTitle.replace('Group ', '')) - 1] || modalTitle) : modalTitle}</h3>
            <div style={{ fontSize: '15px', color: '#555', marginBottom: '10px' }}>{images.length} item{images.length !== 1 ? 's' : ''} in this folder</div>
            {modalTitle.startsWith('Group') && images.length > 0 && !carouselMode && (
              <>
                <button style={{ marginBottom: '10px', marginRight: '10px' }} onClick={openCarousel}>Carousel View</button>
                {(() => {
                  const groupIdx = parseInt(modalTitle.replace('Group ', '')) - 1;
                  return editingGroupName === groupIdx ? (
                    <span style={{ marginLeft: 10 }}>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', marginRight: 4 }}
                      />
                      <button onClick={() => saveGroupName(groupIdx)}>Save</button>
                      <button onClick={() => setEditingGroupName(null)} style={{ marginLeft: 4 }}>Cancel</button>
                    </span>
                  ) : (
                    <button style={{ marginLeft: 10 }} onClick={() => setEditingGroupName(groupIdx)}>Rename Group</button>
                  );
                })()}
                {images.length > 0 && !carouselMode && (
                  <button style={{ marginBottom: '10px', marginRight: '10px', marginLeft: '10px' }} onClick={handleCleanup}>Clean Up</button>
                )}
              </>
            )}
            {modalTitle === 'Uploads' && images.length > 0 && !carouselMode && (
              <button style={{ marginBottom: '10px', marginRight: '10px' }} onClick={handleUploadsCleanup}>Clean Up</button>
            )}
            {carouselMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button onClick={prevPhoto}>&lt;</button>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`http://127.0.0.1:8000/uploads/${images[carouselIndex]}`}
                      alt={images[carouselIndex]}
                      style={{ width: '350px', height: '350px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #ccc' }}
                    />
                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', padding: 4 }}>
                      {getRankingIcon(images[carouselIndex], true)}
                      {showRankingPicker[images[carouselIndex]] && (
                        <div style={{ position: 'absolute', bottom: 28, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, display: 'flex', flexDirection: 'row', gap: 6, padding: 4 }} onClick={e => e.stopPropagation()}>
                          <span style={{ color: 'red', fontSize: 22, cursor: 'pointer' }} title="Reject" onClick={() => updateRanking(images[carouselIndex], 0)}>❌</span>
                          <span style={{ color: 'goldenrod', fontSize: 22, cursor: 'pointer' }} title="Neutral" onClick={() => updateRanking(images[carouselIndex], 1)}>—</span>
                          <span style={{ color: 'hotpink', fontSize: 22, cursor: 'pointer' }} title="Favorite" onClick={() => updateRanking(images[carouselIndex], 2)}>💗</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={nextPhoto}>&gt;</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '14px' }}>{images[carouselIndex]}</div>
                <button style={{ marginTop: '10px' }} onClick={closeCarousel}>Exit Carousel</button>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {images.length === 0 ? (
                  <div>No images found.</div>
                ) : (
                  images.map((img, idx) => (
                    <div key={img} style={{ textAlign: 'center', position: 'relative' }}>
                      <img
                        src={`http://127.0.0.1:8000/uploads/${img}`}
                        alt={img}
                        style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }}
                        onClick={() => openCarouselAt(idx)}
                      />
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>{img}</div>
                      <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(255,255,255,0.8)', borderRadius: '50%', padding: 2 }}>
                        {getRankingIcon(img, true)}
                        {showRankingPicker[img] && (
                          <div style={{ position: 'absolute', bottom: 28, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, display: 'flex', flexDirection: 'row', gap: 6, padding: 4 }} onClick={e => e.stopPropagation()}>
                            <span style={{ color: 'red', fontSize: 22, cursor: 'pointer' }} title="Reject" onClick={() => updateRanking(img, 0)}>❌</span>
                            <span style={{ color: 'goldenrod', fontSize: 22, cursor: 'pointer' }} title="Neutral" onClick={() => updateRanking(img, 1)}>—</span>
                            <span style={{ color: 'hotpink', fontSize: 22, cursor: 'pointer' }} title="Favorite" onClick={() => updateRanking(img, 2)}>💗</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Folders;