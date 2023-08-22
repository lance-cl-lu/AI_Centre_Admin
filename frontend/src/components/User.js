import React, { useState, useEffect} from 'react'
import { useLocation, Link } from 'react-router-dom'
import "./User.css";
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

function User() {
    let state = useLocation().state;
    let [user, setUser] = useState(null);
    useEffect(() => {
        getuserinfo();
    }, [state]);

    let getuserinfo = async () => {
        fetch('http://120.126.23.245:31190/api/ldap/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        .then(response => response.json())
        .then(data => {
            document.getElementsByClassName('userPage')[0].style.opacity = 0;
            setTimeout(() => {
                document.getElementsByClassName('userPage')[0].style.opacity = 1;
            }, 800);
            setUser(data);

        })
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }

    const deleteUser = async () => {
        if(!window.confirm("Are you sure you want to delete this user?")) return;
        let response = await fetch('http://120.126.23.245:31190/api/ldap/user/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "username":state.user,
            }),
        })
        if(response.status===200){
            alert('User deleted successfully');
            window.location.href = '/';
        }
        else {
            console.log('error');
        }
    }

    const editreadonly = async () => {
        if(document.getElementById("editandsave").innerHTML === "Edit"){
            document.getElementById("inputFirstName").readOnly = false;
            document.getElementById("inputLastName").readOnly = false;
            document.getElementById("inputEmail").readOnly = false;
            document.getElementById("editandsave").innerHTML = "Save";
            document.getElementById("editandsave").className = "btn btn-success";
        }
        else if(document.getElementById("editandsave").innerHTML === "Save"){
            document.getElementById("inputFirstName").readOnly = true;
            document.getElementById("inputLastName").readOnly = true;
            document.getElementById("inputEmail").readOnly = true;
            document.getElementById("editandsave").innerHTML = "Edit";
            document.getElementById("editandsave").className = "btn btn-primary";
            //saveUser();
            let response = await fetch('http://120.126.23.245:31190/api/user/change/', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "username": document.getElementById("inputUsername").value,
                    "firstname": document.getElementById("inputFirstName").value,
                    "lastname": document.getElementById("inputLastName").value,
                    "email": document.getElementById("inputEmail").value,
                }),
            });
            if (response.status===200) {
                alert('User information change successfully');
                window.location.href='/'
            } else {
                alert('Something wrong!!!')
            }

        }
    }
    

    return (
        <div className='userPage'>
            <h1>User {state && state.user}</h1><br/>
            <Form className='form-css'>
                <Form.Group as={Row} className="mb-3" controlId="formPlaintextUsername">
                    <Form.Label column sm="2">
                        Username
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext readOnly id="inputUsername" defaultValue={user && user.username} />
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formPlaintextFirstName">
                    <Form.Label column sm="2">
                        First Name
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext readOnly id="inputFirstName" defaultValue={user && user.first_name} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}}/>
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formPlaintextLastName">
                    <Form.Label column sm="2">
                        Last Name
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext readOnly id="inputLastName" defaultValue={user && user.last_name} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}} />
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formPlaintextEmail">
                    <Form.Label column sm="2">
                        Email
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext readOnly id="inputEmail" defaultValue={user && user.email} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}}/>
                    </Col>
                </Form.Group>
                <Button variant="primary" onClick={editreadonly} id='editandsave' className='buttom-button'>
                    Edit
                </Button>
                <Button variant="danger" onClick={deleteUser} className='buttom-button'>
                    Delete
                </Button>
                <Button variant='dark' className='buttom-button'>
                    {user? <Link to='/password' state={state} style={{textDecoration:"none", color:"#fff"}}>Change Password</Link>: null}
                </Button>
            </Form>



        </div>
    )
}
export default User