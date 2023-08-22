import { Form } from "react-bootstrap";

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
            console.log('error');
        }
    }

    return (
        <div>
            <h1>Add Lab</h1>
            <Form onSubmit={addLab}>
                <label>Labatory Name:   </label><input type="text" placeholder="Please enter the lab name" /><br/>
                <input type="submit" value="Submit" />
            </Form>
        </div>
    )
}
export default AddLab
