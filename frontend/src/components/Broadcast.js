import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';

function Broadcast({ isGroupBroadcast = false }) {
  const location = useLocation();
  const state = location.state;
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  // 根據是否為群組廣播決定標題和確認訊息
  const title = isGroupBroadcast 
    ? `Broadcast Email to Group: ${state?.lab || 'Unknown'}` 
    : 'Broadcast Email to All Users';
  
  const confirmText = isGroupBroadcast
    ? `Send this email to all members in ${state?.lab}?`
    : 'Send this email to all users?';

  const apiEndpoint = isGroupBroadcast 
    ? '/api/group/broadcast/' 
    : '/api/broadcast/';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subject.trim() || !content.trim()) {
      Swal.fire({
        title: 'Error!',
        text: 'Please fill in both subject and content',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm Broadcast',
      text: confirmText,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, send it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      setSending(true);

      Swal.fire({
        title: 'Sending...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        // 根據是否為群組廣播決定傳送的資料
        const requestBody = isGroupBroadcast
          ? { lab: state?.lab, subject, content }
          : { subject, content };

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        Swal.close();

        if (response.ok) {
          Swal.fire({
            title: 'Success!',
            text: 'Email broadcast sent successfully',
            icon: 'success',
            timer: 2000
          });
          setSubject('');
          setContent('');
        } else {
          const errorData = await response.json();
          Swal.fire({
            title: 'Error!',
            text: errorData.message || 'Failed to send broadcast',
            icon: 'error'
          });
        }
      } catch (error) {
        Swal.close();
        Swal.fire({
          title: 'Error!',
          text: 'Network error: ' + error.message,
          icon: 'error'
        });
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div style={{ 
      fontFamily: "Comic Sans MS", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center",
      padding: "20px"
    }}>
      <h2 style={{ marginBottom: "30px" }}>{title}</h2>
      
      <Form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "600px" }}>
        <Form.Group className="mb-3" controlId="formSubject">
          <Form.Label>Subject</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="formContent">
          <Form.Label>Content</Form.Label>
          <Form.Control
            as="textarea"
            rows={10}
            placeholder="Enter email content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={sending}
          />
        </Form.Group>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <Button 
            variant="primary" 
            type="submit"
            disabled={sending}
          >
            {sending ? 'Sending...' : (isGroupBroadcast ? 'Send to Group' : 'Send Broadcast')}
          </Button>
          <Button 
            variant="secondary" 
            type="button"
            onClick={() => {
              setSubject('');
              setContent('');
            }}
            disabled={sending}
          >
            Clear
          </Button>
          {isGroupBroadcast && (
            <Button 
              variant="danger" 
              type="button"
              onClick={() => window.history.back()}
              disabled={sending}
            >
              Cancel
            </Button>
          )}
        </div>
      </Form>
    </div>
  );
}

export default Broadcast;

