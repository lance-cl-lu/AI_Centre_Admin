import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';


function AddExcel() {
    let handleSubmit= async() => {
        console.log(document.getElementById('excel').value);
        if (!document.getElementById('excel').value) {
            console.log("You have selected the file: ", document.getElementById('excel'));
            return;
        }
        const formData = new FormData();
        formData.append("file", document.getElementById('excel').value);
        fetch('http://localhost:8000/api/ldap/excel/', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            alert('Excel file uploaded successfully');
        }
        )
        .catch(error => {
            console.error('Error:', error);
        }
        )
    }
    return (
        <div className='AddContent'>
            <Form>
                <Form.Group controlId="formFile" className="mb-3">
                    <Form.Label>Import Excel File</Form.Label>
                    <Form.Control name='file' type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" id="excel"  />
                </Form.Group>
                <Button variant="primary" type="button" onClick={handleSubmit}>
                    Submit
                </Button>
            </Form>
        </div>
    )
}
export default AddExcel