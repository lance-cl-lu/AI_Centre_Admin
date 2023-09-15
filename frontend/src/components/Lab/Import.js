import React from "react";
import { useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import { Button, Form } from "react-bootstrap";
function LabImport() {
    const lab = useLocation().state['lab'];
    const user = localStorage.getItem('authToken')
        ? jwt_decode(localStorage.getItem('authToken'))['username']
        : null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const fileInput = document.getElementById('file');
        if (!fileInput.files[0]) {
        alert('Please select an Excel file');
        return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('lab', lab);

        try {
        const response = await fetch('http://120.126.23.245:31190/api/ldap/lab/excel/import/', {
            method: 'POST',
            headers: {
            // No need for Content-Type when sending FormData
            // 'Content-Type': 'application/json',
            },
            body: formData,
        });

        if (response.status === 200) {
            alert('Excel added successfully');
            window.location.href = '/';
        } else {
            // alert error message
            let data = await response.json();
            alert(data['message']);
        }
        } catch (error) {
        console.error('Error adding Excel:', error);
        alert('An error occurred while adding Excel');
        }
    };
    const handeCancel = () => {
        // back to previous page
        window.history.back();
    };

    return (
        <div>
          <h1>Add Excel for {lab}</h1>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="file">
                <Form.Label>Excel File</Form.Label>
                <Form.Control type="file" accept=".xlsx" />
            </Form.Group>
            <Button variant="primary" type="submit">Submit</Button>
            <Button variant="warning" type="button" onClick={handeCancel} style={{ margin: '1rem' }}>Cancel and Back</Button>
        </Form>

        </div>
      );
}
export default LabImport;