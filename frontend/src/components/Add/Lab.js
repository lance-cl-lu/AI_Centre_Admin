import { Button, Form } from "react-bootstrap";
import { useLocation } from "react-router-dom";
function AddLab() {
    let addLab = async(e) => {
        let response = await fetch('/api/ldap/lab/add/', {    
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({"lab":e.target[0].value, "cpu_quota":e.target[1].value, "mem_quota":e.target[2].value, "gpu_quota":e.target[3].value, "gpu_vendor":e.target[4].value}),
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
                <div className="row">
                    <Form.Group controlId="formBasicEmail">
                        <Form.Label>Group Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter Group Name" />
                    </Form.Group>
                </div>
                <br/>
                <div style={{fontFamily: "Comic Sans MS"}} className="row">
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>CPU Quota</Form.Label>
                    <Form.Control type="text" placeholder="Enter CPU Quota" id="cpu_quota" defaultValue={8} />
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>Memory Quota (Gi)</Form.Label>
                    <Form.Control type="text" placeholder="Enter Memory Quota" id="mem_quota" defaultValue={16} />
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>GPU Quota</Form.Label>
                    <Form.Control as="select" id="gpu_quota" defaultValue={1}>
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option>value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                    </Form.Control>
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>GPU Vendor</Form.Label>
                    <Form.Control as="select" id="gpu_vendor" defaultValue={"nvidia"}>
                        <option value="NVIDIA">nvidia</option>
                        <option value="AMD">amd</option>
                    </Form.Control>
                </Form.Group>
                </div>
                <Button variant="primary" type="submit">Submit</Button>
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
            </Form>
        </div>
    )
}

export default AddLab;
