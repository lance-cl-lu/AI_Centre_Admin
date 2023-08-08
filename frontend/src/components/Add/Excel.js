import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';


function AddExcel() {
    function handleSubmit(event) {
        event.preventDefault();
        console.log(event.target.files[0]);
        if (!event.target.files[0]) {
            console.log("You have selected the file: ", event.target.files[0]);
            return;
        }
        const formData = new FormData();
        formData.append("file", event.target.files[0]);
        fetch('http://127.0.0.1:8000/ldap/excel/', {
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
                <Form.Group controlId="formFile" className="mb-3" onSubmit={handleSubmit}>
                    <Form.Label>Import Excel File</Form.Label>
                    <Form.Control type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"  />
                </Form.Group>
                <Button variant="primary" type="submit">
                    Submit
                </Button>
            </Form>
        </div>
    )
}
export default AddExcel