import { Button, Form } from "react-bootstrap";

function AddLab() {

    let addLab = async(e) => {
        let response = await fetch('http://localhost:8000/api/ldap/lab/add/', {    
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
            <Form onSubmit={addLab} style={{height: "10vh", display: "flex", alignItems: "center", justifyContent: "center"}}>
                <label style={{fontSize:"24px"}}>Labatory Name:   </label><input style={{marginLeft:"2.5vh"}} type="text" placeholder="Please enter the lab name" />
                <Button type="submit" value="Submit" variant="primary" style={{marginLeft:"2.5vh"}}>Submit</Button>
            </Form>
        </div>
    )
}
export default AddLab
