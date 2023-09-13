import React, { useState, useEffect} from 'react'
import { useLocation, Link } from 'react-router-dom'
import "./User.css";
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { SERVICE_IP, SERVICE_PORT} from './Urls';

function User() {
    let state = useLocation().state;
    let [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    useEffect(() => {
        getuserinfo();
    }, [state]);

    let getuserinfo = async () => {
        document.getElementsByClassName('userPage')[0].style.opacity = 0;

        fetch('http://' + SERVICE_IP + ':' + SERVICE_PORT + '/api/ldap/user/', {
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

            setTimeout(() => {
                setUser(data);
                setPermissions(data.permission);
                // refresh edit button
                document.getElementById("editandsave").className = "btn btn-primary";
                document.getElementById("editandsave").innerHTML = "Edit";
            }, 400);
            setTimeout(() => {
                document.getElementsByClassName('userPage')[0].style.opacity = 1;
            }, 300);
        })
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }

    const deleteUser = async () => {
        if(!window.confirm("Are you sure you want to delete this user?")) return;
        let response = await fetch('http://' + SERVICE_IP + ':' + SERVICE_PORT + '/api/ldap/user/delete/', {
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
            document.getElementById("inputRadio").readOnly = false;
            document.getElementById("editandsave").innerHTML = "Save";
            document.getElementById("editandsave").className = "btn btn-success";
        }
        else if(document.getElementById("editandsave").innerHTML === "Save"){
            document.getElementById("inputFirstName").readOnly = true;
            document.getElementById("inputLastName").readOnly = true;
            document.getElementById("inputEmail").readOnly = true;
            document.getElementById("inputRadio").readOnly = true;
            document.getElementById("editandsave").innerHTML = "Edit";
            document.getElementById("editandsave").className = "btn btn-primary";
            //saveUser();
            let response = await fetch('http://' + SERVICE_IP + ':' + SERVICE_PORT + '/api/user/change/', {
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
                    <Form.Group as={Row} className="mb-3" controlId="formPlaintextUsername" style={{flexWrap: 'nowrap'}}>
                        <Form.Label column sm="2">
                            Username
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext readOnly id="inputUsername" style={{flexWrap: 'nowrap'}} defaultValue={user && user.username} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}} controlId="formPlaintextFirstName">
                        <Form.Label column sm="2">
                            First Name
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext readOnly id="inputFirstName" style={{flexWrap: 'nowrap'}} defaultValue={user && user.first_name} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}}/>
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}} controlId="formPlaintextLastName">
                        <Form.Label column sm="2">
                            Last Name
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext readOnly id="inputLastName" style={{flexWrap: 'nowrap'}} defaultValue={user && user.last_name} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3" style={{flexWrap: 'nowrap'}} controlId="formPlaintextEmail">
                        <Form.Label column sm="2">
                            Email
                        </Form.Label>
                        <Col sm="10">
                            <Form.Control plaintext readOnly id="inputEmail" style={{flexWrap: 'nowrap'}} defaultValue={user && user.email} style={{border:"ridge 1px", width:"20%", borderRadius:"10px"}}/>
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3" controlId="formPlaintextRole">
                        { user && permissions && Object.keys(permissions).map((key, index) => {
                            return(
                                <div key={index} style={{display:'flex', width:"100%", alignItems: "center", flexWrap: 'nowrap'}}>
                                    <Form.Label column sm="2">
                                        {key}
                                    </Form.Label>
                                    <Col sm="1">
                                        {/* if admin radio true */}
                                        <Form.Check type="checkbox" name={key} id="inputRadio" checked={permissions[key] === "admin" ? true : false} readOnly/>
                                    </Col>
                                </div>
                            )
                        })}
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