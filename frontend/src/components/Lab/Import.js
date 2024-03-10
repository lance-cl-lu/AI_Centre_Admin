import React from "react";
import { useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import { Button, Form } from "react-bootstrap";
import WarningIcon from '@mui/icons-material/Warning';
import { Toast } from "react-bootstrap";
import Swal from "sweetalert2";
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
        const response = await fetch('/api/ldap/lab/excel/import/', {
            method: 'POST',
            headers: {
            // No need for Content-Type when sending FormData
            // 'Content-Type': 'application/json',
            },
            body: formData,
        });

        if (response.status === 200) {
            Swal.fire({
                title: 'Excel added successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
            });
            setTimeout(() => {
                window.history.back();
            }, 2000);
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

    const handletemplate = async (e) => {
        e.preventDefault();
        try {
          const response = await fetch(`/api/ldap/excel/template/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (response.status === 200) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${lab}_template.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          } else {
            // alert error message
            let data = await response.json();
            alert(data['message']);
          }
        } catch (error) {
          console.error('Error downloading Excel template:', error);
          alert('An error occurred while downloading Excel template');
        }
      }

    return (
        <div>
          <h1>Add Excel for {lab}</h1>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="file">
                <Form.Label>
                  Excel File
                </Form.Label>
                <Form.Control type="file" accept=".xlsx" />
            </Form.Group>
            <Toast style={{position: "absolute", top: "11vh", right: "5vw"}} bg={'warning'}>
                <Toast.Body><WarningIcon/>
                {' '}Warning!! Email and username will be converted to lowercase.</Toast.Body>
            </Toast>
            <Button variant="secondary" type="button" onClick={handletemplate} style={{ margin: '1rem' }}>Download Template</Button>
            <Button variant="primary" type="submit" style={{ margin: '1rem' }}>Submit</Button>
            <Button variant="warning" type="button" onClick={handeCancel} style={{ margin: '1rem' }}>Cancel and Back</Button>
        </Form>

        </div>
      );
}
export default LabImport;
