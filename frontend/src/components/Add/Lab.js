import { Button, Form } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import { SERVICE_IP, SERVICE_PORT} from '../Urls';
function AddLab() {
    let addLab = async(e) => {
        let response = await fetch('http://' + SERVICE_IP + ':' + SERVICE_PORT + '/api/ldap/lab/add/', {    
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({"lab":e.target[0].value}),
        });
        let data = await response.json();
        if(response.status===200){
            console.log(data);
            alert('Lab added successfully');
        } else {
            alert(response.data);
        }
    }

    return (
        <div style={{fontFamily: "Comic Sans MS"}}>
            <h1>Add Group</h1><br/>
            <Form onSubmit={addLab}>
                <Form.Group controlId="formBasicEmail">
                    <Form.Label>Group Name</Form.Label>
                    <Form.Control type="text" placeholder="Enter Group Name" />
                </Form.Group>
                <Button variant="primary" type="submit">Submit</Button>
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
            </Form>
        </div>
    )
}
export default AddLab
