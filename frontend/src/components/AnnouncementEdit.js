import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAuthHeaders, handleUnauthorized } from '../utils/auth';

const USE_MOCK_DATA = process.env.REACT_APP_ANNOUNCEMENT_MODE === 'mock';

const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: '注意', label: '注意' },
  { value: '公告', label: '公告' },
];

const toDisplayType = (type) => {
  if (type === 'warning') {
    return '注意';
  }
  if (type === 'info' || type === 'success') {
    return '公告';
  }
  if (type === '公告' || type === '注意') {
    return type;
  }
  return '公告';
};

const toStoredType = (type) => {
  if (type === '注意') {
    return '注意';
  }
  if (type === '公告') {
    return '公告';
  }
  return type || '公告';
};

const today = () => new Date().toISOString().slice(0, 10);

const styles = {
  row: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: '#f0f0f0',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  value: {
    marginBottom: '10px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#111827',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    minHeight: '160px',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#111827',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
};

const AnnouncementEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    content: '',
    type: '公告',
    date: today(),
  });

  const isCreateMode = id === 'new';
  const announcementId = useMemo(() => Number(id), [id]);

  useEffect(() => {
    const loadCurrent = async () => {
      setLoading(true);
      setError('');

      if (isCreateMode) {
        setFormData((prev) => ({
          ...prev,
          id: null,
          title: '',
          content: '',
          type: '公告',
          date: today(),
        }));
        setLoading(false);
        return;
      }

      if (!Number.isFinite(announcementId)) {
        setError('Announcement ID 不正確');
        setLoading(false);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/announcements/${announcementId}/`, {
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
        const current = data?.announcement;

        if (!current) {
          throw new Error('找不到該筆 Announcement');
        }

        setFormData({
          id: current.id,
          title: current.title || '',
          content: current.content || '',
          type: toDisplayType(current.type),
          date: current.date || today(),
        });
      } catch (err) {
        setError(`載入失敗：${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (USE_MOCK_DATA) {
      setLoading(false);
      setError('目前為 mock 模式，請切換至 API 模式後編輯。');
      return;
    }

    loadCurrent();
  }, [announcementId, isCreateMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        handleUnauthorized();
        return;
      }

      if (isCreateMode) {
        const listRes = await fetch('/api/announcements/', { headers });
        let listPayload = null;
        try {
          listPayload = await listRes.json();
        } catch (parseError) {
          listPayload = null;
        }

        if (!listRes.ok) {
          if (listRes.status === 401) {
            handleUnauthorized();
            return;
          }
          const detail = listPayload && listPayload.detail ? listPayload.detail : `HTTP ${listRes.status}`;
          throw new Error(detail);
        }

        const listData = typeof listPayload === 'string' ? JSON.parse(listPayload) : listPayload;
        const currentAnnouncements = Array.isArray(listData?.announcements) ? listData.announcements : [];
        const nextItem = {
          id: currentAnnouncements.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1,
          date: today(),
          title: formData.title,
          content: formData.content,
          type: toStoredType(formData.type),
        };

        const createRes = await fetch('/api/announcements/', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ announcements: [nextItem, ...currentAnnouncements] }),
        });

        let createPayload = null;
        try {
          createPayload = await createRes.json();
        } catch (parseError) {
          createPayload = null;
        }

        if (!createRes.ok) {
          if (createRes.status === 401) {
            handleUnauthorized();
            return;
          }
          const detail = createPayload && createPayload.detail ? createPayload.detail : `HTTP ${createRes.status}`;
          throw new Error(detail);
        }
      } else {
        const payload = {
          title: formData.title,
          content: formData.content,
          type: toStoredType(formData.type),
        };

        const res = await fetch(`/api/announcements/${announcementId}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });

        let responsePayload = null;
        try {
          responsePayload = await res.json();
        } catch (parseError) {
          responsePayload = null;
        }

        if (!res.ok) {
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          const detail = responsePayload && responsePayload.detail ? responsePayload.detail : `HTTP ${res.status}`;
          throw new Error(detail);
        }
      }

      navigate('/announcement');
    } catch (err) {
      setError(`${isCreateMode ? '新增' : '更新'}失敗：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div style={{ padding: '16px', background: '#fff' }}>
      <div style={{ marginBottom: '16px', padding: '16px', border: '1px solid #d8d8d8', borderRadius: '12px', background: '#fafafa' }}>
        <h2 style={{ margin: 0 }}>{isCreateMode ? '新增 Announcement' : `編輯 Announcement #${id}`}</h2>
      </div>

      {loading && <p>載入中...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px', maxWidth: '720px' }}>
          <div style={styles.row}>
            <div style={styles.label}>標題</div>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.row}>
            <div style={styles.label}>內容</div>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              style={styles.textarea}
              required
            />
          </div>

          <div style={{ ...styles.row, display: 'none' }}>
            <div style={styles.label}>類型</div>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              style={styles.input}
            >
              {ANNOUNCEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {!isCreateMode && (
            <div style={styles.row}>
              <div style={styles.label}>最後修改日期</div>
              <div style={styles.value}>{formData.date}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{ border: '1px solid #146c43', background: '#e8f5ee', color: '#146c43', padding: '8px 14px', borderRadius: '8px', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/announcement')}
              style={{ border: '1px solid #667085', background: '#f2f4f7', color: '#344054', padding: '8px 14px', borderRadius: '8px' }}
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AnnouncementEdit;