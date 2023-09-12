import React from 'react';
import jwt_decode from 'jwt-decode';

function AddExcel() {
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
    formData.append('user', user);

    try {
      const response = await fetch('http://120.126.23.245:31190/api/ldap/excel/', {
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
        alert('Excel create error');
      }
    } catch (error) {
      console.error('Error adding Excel:', error);
      alert('An error occurred while adding Excel');
    }
  };

  return (
    <div>
      <h1>Add Excel</h1>
      <form onSubmit={handleSubmit}>
        <label>Excel: </label>
        <input type="file" name="file" id="file" accept=".xlsx" />
        <br />
        <input type="submit" value="Submit" />
      </form>
    </div>
  );
}

export default AddExcel;
