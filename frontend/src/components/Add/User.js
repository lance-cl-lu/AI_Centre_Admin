import React, { useEffect, useState } from 'react'
import jwt_decode from "jwt-decode";
import './User.css'
import { Button, Form } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
function AddUser() {
    const [lab, setLab] = useState([]);
    const [user] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['username'] : null);
    const group = useLocation().state['group'];
    console.log(group);
    const state = useLocation().state; 
    useEffect(() => {
        fetch('http://120.126.23.231:31190/api/ldap/lab/list/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => setLab(data))
        .catch((error) => {
            console.error('Error:', error);
        }
        );
    }, []);

    let handleSubmit = async(e) => {
        e.preventDefault();
        if(e.target[6].value===e.target[7].value){
            let response = await fetch('http://120.126.23.231:31190/api/ldap/user/add/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "first_name":e.target[0].value,
                    "last_name":e.target[1].value,
                    "username":e.target[2].value,
                    "email":e.target[3].value,
                    "lab":e.target[4].value,
                    "is_lab_manager": e.target[5].checked,
                    "password":e.target[6].value,
                }),
            });
            if(response.status===200){
                alert('User added successfully');
                window.location.reload();
            } else {
                alert('User create error');
            }
        } else {
            alert('Passwords do not match');
        }
    }

    return (
        <div style={{fontFamily: "Comic Sans MS", display: "flex", flexDirection: "column", alignItems: "center"}}>
            <h1>Add User</h1><br></br>
            {/*<form onSubmit={handleSubmit} className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px", width: "75%"}}>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start", width:"100%"}}><label className='form-label'>First Name:   </label><input type="text" placeholder="Please enter the first name" style={{width: "70%"}} /></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start", width:"100%"}}><label className='form-label'>Last Name:   </label><input type="text" placeholder="Please enter the last name" style={{width: "71%"}} /></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start", width:"100%"}}><label className='form-label'>Username:   </label><input type="text" placeholder="Please enter the username" style={{width: "72%"}} /></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start", width:"100%"}}><label className='form-label'>Email: </label><input type="text" placeholder="Please enter the email" style={{width: "76%"}} /></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start", width:"100%"}}><label className='form-label'>In which labatory:   </label>{lab && <select>
                    { group !=='null' ? <option value={group}>{group}</option> : <option value="null">Please select the labatory</option>}
                    {lab.map((lab, index) => {
                        return <option key={index} value={lab}>{lab}</option>
                    })}

                </select>}</div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start"}}><label className='form-label'>Is Lab Manager:   <input type="checkbox"/></label></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start"}}><label className='form-label'>Password:   </label><input type="text" placeholder="Please enter the password" style={{width: "73%"}} /></div><br/>
                <div className='form-div' style={{display:"flex", alignItems:"center", justifyContent:"flex-start"}}><label className='form-label'>Confirm Password:   </label><input type="text" placeholder="Please enter the password again" style={{width: "66%"}} /></div><br/>
            	<Button type="submit" variant="primary" style={{ margin: '1rem' }}>Submit</Button>
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
                </form>
            */}
            {
                <Form onSubmit={handleSubmit} className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "12px", borderRadius: "12px", width: "75%"}}>
                    <Form.Group className="mb-3" controlId="formBasicEmail" style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>First Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter First Name" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail" style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>Last Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter Last Name" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail" style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>Username</Form.Label>
                        <Form.Control type="text" placeholder="Enter Username" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail"  style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>Email</Form.Label>
                        <Form.Control type="text" placeholder="Enter Email" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail"  style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"30%"}}>In which group?</Form.Label>
                        <Form.Control as="select">
                            { group !=='null' ? <option value={group}>{group}</option> : <option value="null">Please select the group</option>}
                            {lab.map((lab, index) => {
                                return <option key={index} value={lab}>{lab}</option>
                            }
                            )}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicEmail" style={{display:"flex", justifyContent:"space-evenly"}}>
                        <Form.Check type="checkbox" label="Is Group Manager" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicPassword"  style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>Password</Form.Label>
                        <Form.Control type="password" placeholder="Enter Password" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicPassword"  style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Label style={{width:"20%"}}>Confirm Password</Form.Label>
                        <Form.Control type="password" placeholder="Enter Password Again" />
                    </Form.Group>
                    <Button variant="primary" type="submit" style={{ margin: '1rem' }}>Submit</Button>
                    <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
                </Form>
            }
            <br/>

        </div>
    )
}

export default AddUser
