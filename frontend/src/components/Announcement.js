import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders, handleUnauthorized } from '../utils/auth';

const MOCK_ANNOUNCEMENTS = {
  announcements: [
    {
      id: 10,
      date: '2026-05-20',
      title: 'GPU 節點維護預告',
      content: '預計於下週三凌晨 02:00 進行運算節點升級，屆時部分任務可能暫停。',
      type: 'warning',
    },
    {
      id: 9,
      date: '2026-05-15',
      title: '新版 Kubeflow SDK 課程',
      content: '內部訓練課程已上傳至 Wiki，歡迎開發人員參考學習。',
      type: 'info',
    },
    {
      id: 8,
      date: '2026-05-01',
      title: '五月份系統穩定度報告',
      content: '上月份系統可用性達 99.9%，感謝各單位的配合。',
      type: 'success',
    },
  ],
};

const USE_MOCK_DATA = process.env.REACT_APP_ANNOUNCEMENT_MODE === 'mock';

const Announcement = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setAnnouncements(MOCK_ANNOUNCEMENTS.announcements);
      setLoading(false);
      setError('目前為前端假資料模式，未呼叫後端 API。');
      return;
    }

    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/announcements/', {
        headers,
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch (parseError) {
        payload = null;
      }

      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        const detail = payload && payload.detail ? payload.detail : `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
    } catch (err) {
      setAnnouncements([]);
      setError(`載入 Announcement 失敗：${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(announcements.map(a => a.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDelete = async () => {
    setError('');
    if (USE_MOCK_DATA) {
      setAnnouncements((prev) => prev.filter((item) => !selected.includes(item.id)));
      setSelected([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        handleUnauthorized();
        return;
      }
      const res = await fetch('/api/announcements/', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ ids: selected }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      setSelected([]);
      fetchAnnouncements();
    } catch (err) {
      setError(`刪除失敗：${err.message}`);
    }
  };

  const handleEditOpen = (row) => {
    navigate(`/announcement/edit/${row.id}`);
  };

  const handleAppendOpen = () => {
    navigate('/announcement/edit/new');
  };

  return (
    <div style={{ padding: '16px', background: '#fff' }}>
      <div style={{ marginBottom: '16px', padding: '16px', border: '1px solid #d8d8d8', borderRadius: '12px', background: '#fafafa' }}>
        <h2 style={{ margin: 0 }}>Announcement 管理</h2>
        <p style={{ margin: '8px 0 0' }}>筆數: {announcements.length}</p>
      </div>
      {loading && <p>載入中...</p>}
      {error && <p style={{ color: USE_MOCK_DATA ? '#666' : 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleAppendOpen}
          style={{ border: '1px solid #1f6feb', background: '#e8f1ff', color: '#0b3d91', padding: '8px 14px', borderRadius: '8px' }}
        >
          Append
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selected.length === 0}
          style={{ border: '1px solid #b42318', background: '#fff1f0', color: '#b42318', padding: '8px 14px', borderRadius: '8px', opacity: selected.length === 0 ? 0.5 : 1 }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={(e) => handleSelectAll({ target: { checked: selected.length !== announcements.length } })}
          disabled={announcements.length === 0}
          style={{ border: '1px solid #667085', background: '#f2f4f7', color: '#344054', padding: '8px 14px', borderRadius: '8px', opacity: announcements.length === 0 ? 0.5 : 1 }}
        >
          Select All
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>選取</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>ID</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>日期</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>標題</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>內容</th>
            <th style={{ border: '1px solid #ccc', padding: '8px', display: 'none' }}>類型</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {announcements.map((row) => (
            <tr key={row.id}>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(row.id)}
                  onChange={() => handleSelect(row.id)}
                />
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{row.id}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{row.date}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{row.title}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{row.content}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px', display: 'none' }}>{row.type}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleEditOpen(row)}
                  style={{ border: '1px solid #1d4ed8', background: '#eef4ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: '8px' }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Announcement;
