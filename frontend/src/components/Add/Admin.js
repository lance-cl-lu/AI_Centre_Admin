import React, { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";


function AddAdmin() {
    const [user, setUser] = useState([]);

    useEffect(() => {
        fetch('/api/ldap/user/list/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => setUser(data))
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }, []);

    let handleSubmit = async(e) => {
        if(window.confirm('Are you sure you want to add this user as an admin?')){
            e.preventDefault();
            let response = await fetch('/api/ldap/admin/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username":e.target[0].value,
                }),
            });
            if(response.status===200){
                alert('Admin added successfully');
                window.location.reload();
            } else {
                console.log('error');
            }
        }
    }
    return (
        <div>
            <h1>Add Admin</h1>
            {/*<form onSubmit={handleSubmit}>
                <lable>Choice a User to be the OpenLDAP administer:</lable>
                <select> {user && user.map((user) => (
                    <option value={user} id={user}>{user}</option>
                ))}</select><br/>
                <input type="submit" value="Submit" />
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
                </form>*/}
            <Form onSubmit={handleSubmit}>
                <Form.Group controlId="formBasicEmail">
                    <Form.Label>Choice a User to be the administer:</Form.Label>
                    <Form.Control as="select">
                        {user && user.map((user) => (
                            <option value={user} id={user}>{user}</option>
                        ))}
                    </Form.Control>
                </Form.Group>
                <Button variant="primary" type="submit" style={{ margin: '1rem' }}>Submit</Button>
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
            </Form>
        </div>
    )
}

export default AddAdmin
