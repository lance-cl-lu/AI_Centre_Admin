import { Button, Form } from "react-bootstrap";
import { useLocation } from "react-router-dom";
function AddLab() {
    let addLab = async(e) => {
        let response = await fetch('http://120.126.23.245:31190/api/ldap/lab/add/', {    
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
            <h1>Add Lab</h1><br/>
            <Form onSubmit={addLab}>
                <Form.Group controlId="formBasicEmail">
                    <Form.Label>Group Name</Form.Label>
                    <Form.Control type="text" placeholder="Enter Lab Name" />
                </Form.Group>
                <Button variant="primary" type="submit">Submit</Button>
                <Button variant="warning" onClick={() => window.location.reload()}>Cancel and Back</Button>
            </Form>
        </div>
    )
}
export default AddLab
