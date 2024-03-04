import React, { useEffect, useState } from 'react'
//import jwt_decode from "jwt-decode";
import './User.css'
import { Button, Form, FloatingLabel } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2'


function AddUser() {
    const [lab, setLab] = useState([]);
    //const [user] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['username'] : null);
    const group = useLocation().state['group'];
    console.log(group);
    //const state = useLocation().state; 
    useEffect(() => {
        fetch('/api/ldap/lab/list/', {
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
        // first_name, last_name and username cannot be empty and have _ and - in the username
        if(e.target[0].value== null){
            alert('First name cannot be empty');
            return;
        }
        if(e.target[1].value== null){
            alert('Last name cannot be empty');
            return;
        }
        // test empty username
        if(e.target[2].value == null){
            alert('Username cannot be empty');
            return;
        }

        // first_name, last_name and username
        if(e.target[2].value.includes('_') || e.target[2].value.includes('-') || e.target[2].value.includes(' ')){
            alert('Username cannot include _ and - and space');
            return;
        }
        if (e.target[6].value===''){
            Swal.fire({
                title: 'Password cannot be empty',
                icon: 'error',
                timer: 2000,
                timerProgressBar: true,
            })
            return;
        }
        if (e.target[7].value===''){
            Swal.fire({
                title: 'Confirm Password cannot be empty',
                icon: 'error',
                timer: 2000,
                timerProgressBar: true,
            })
            return;
        }
        
        if(e.target[6].value===e.target[7].value){
            let response = await fetch('/api/ldap/user/add/', {
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
                    "cpu_quota":e.target[8].value,
                    "mem_quota":e.target[9].value,
                    "gpu_quota":e.target[10].value,
                }),
            });
            if(response.status===200){
                Swal.fire({
                    title: 'User created successfully',
                    icon: 'success',
                    confirmButtonText: 'Cool',
                    timer: 2000
                })
                setTimeout(() => {
                    // previous page
                    window.history.back();
                }, 2000);
            } else if(response.status===500){ 
                // get message from response
                let data = await response.json();
                Swal.fire({
                    title: data['message'],
                    icon: 'error',
                    timer: 10000,
                    timerProgressBar: true,
                })
                // clear the password
                e.target[6].value = '';
                e.target[7].value = '';
            } else {
                alert('User create error');
            }
        } else {
            alert('Passwords do not match');
        }
    }

    let handleCheckEmail = async(e) => {
        e.preventDefault();
        if (e.target[3].value===''){
            alert('Please enter the email');
            return;
        }
        let response = await fetch('/api/ldap/user/check_email/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "email":e.target[3].value,
            }),
        });
        if(response.status===200){
            alert('Email is available');
        } else {
            alert('Email is not available');
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
                    <Form.Group>
                        CPU Quota
                        <FloatingLabel
                            controlId="floatingSelect"
                            label="CPU Quota"
                            className="mb-3"
                        >
                        <Form.Control type="number" id="cpuQuota" placeholder="Enter CPU Quota" min="1" max="16" defaultValue="8" step="1" />
                        </FloatingLabel>
                    </Form.Group>
                    <Form.Group>
                        Memory Quota
                        <FloatingLabel
                            controlId="floatingSelect"
                            label="Memory Quota (Gi)"
                            className="mb-3"
                        >
                        <Form.Control type="number" id="memQuota" placeholder="Enter Memory Quota" min="1" defaultValue="16" step="0.1"/>
                        </FloatingLabel>
                    </Form.Group>
                    <Form.Group>
                        GPU Quota
                        <FloatingLabel
                            controlId="floatingSelect"
                            label="GPU Quota"
                            className="mb-3"
                        >
                            <Form.Select>
                                <option>0</option>
                                <option selected>1</option>
                                <option>2</option>
                                <option>3</option>
                                <option>4</option>
                                <option>5</option>
                                <option>6</option>
                                <option>7</option>
                                <option>8</option>
                            </Form.Select>
                        </FloatingLabel>
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
