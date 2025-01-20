import React, { useEffect, useState } from 'react'
//import jwt_decode from "jwt-decode";
import './User.css'
import { Button, Form, FloatingLabel } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2'
import Toast from 'react-bootstrap/Toast';
import WarningIcon from '@mui/icons-material/Warning';

function AddUser() {
    const [lab, setLab] = useState([]);
    const [isGPUQuotaDisabled, setIsGPUQuotaDisabled] = useState(true); // State to manage GPUQuota disabled state
    const group = useLocation().state['group'];
    console.log(group);
    //const state = useLocation().state; 
    useEffect(() => {

        fetchDefaultValues();
    }, []);

    const fetchDefaultValues = () => {
        fetch('/api/ldap/lab/default_values/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                labname: document.getElementById('addUserGroup').value,
            }),
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('cpuQuota').value = data['cpu_quota'];
            document.getElementById('memQuota').value = data['mem_quota'];
            document.getElementById('GPUQuota').value = data['gpu_quota'];
            document.getElementById('GPUVendor').value = data['gpu_vendor'];
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    };

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
        // test cpu, mem and gpu quota and gpu vendor
        if(e.target[9].value===''){
            alert('CPU Quota cannot be empty');
            return;
        }
        if(e.target[10].value===''){
            alert('Memory Quota cannot be empty');
            return;
        }
        if(e.target[11].value===''){
            alert('GPU Quota cannot be empty');
            return;
        }
        if(e.target[12].value===''){
            alert('GPU Vendor cannot be empty');
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
                    "labdefault": e.target[8].value,
                    "cpu_quota":e.target[9].value,
                    "mem_quota":e.target[10].value,
                    "gpu_quota":e.target[11].value,
                    "gpu_vendor":e.target[12].value,
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

    return (
        <div style={{fontFamily: "Comic Sans MS", display: "flex", flexDirection: "column", alignItems: "center"}}>
            <h1>Add User</h1><br></br>
            <Toast style={{position: "absolute", top: "11vh", right: "12vw"}} bg={'warning'}>
                <Toast.Body><WarningIcon/>
                {' '}Warning!! Email and username will be converted to lowercase.</Toast.Body>
            </Toast>
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
                        <Form.Control as="select" id="addUserGroup" style={{width:"50%"}}>
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
                    <Form.Group className="mb-3" controlId="formBasicCheckbox" style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", margin:"12px"}}>
                        <Form.Check type="checkbox" defaultChecked label="Group Default Values" onClick={(e) => {
                            setIsGPUQuotaDisabled(e.target.checked);
                            if(e.target.checked){
                                // get group default values
                                fetch('/api/ldap/lab/default_values/', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        "labname": document.getElementById('addUserGroup').value,
                                    }),
                                })
                                .then(response => response.json())
                                .then(data => {
                                    document.getElementById('cpuQuota').value = data['cpu_quota'];
                                    document.getElementById('memQuota').value = data['mem_quota'];
                                    // change the selected value in GPUQuota and GPUVendor
                                    document.getElementById('GPUQuota').value = data['gpu_quota'];
                                    document.getElementById('GPUVendor').value = data['gpu_vendor'];
                                })
                                .catch((error) => {
                                    console.error('Error:', error);
                                }
                                );
                            }
                        }}/>
                    </Form.Group>
                    <Form.Group>
                        CPU Quota
                        <FloatingLabel
                            controlId="floatingSelect"
                            label="CPU Quota"
                            className="mb-3"
                        >
                        <Form.Control type="number" id="cpuQuota" placeholder="Enter CPU Quota" min="1" max="16" defaultValue="8" step="1" disabled={isGPUQuotaDisabled}/>
                        </FloatingLabel>
                    </Form.Group>
                    <Form.Group>
                        Memory Quota
                        <FloatingLabel
                            controlId="floatingSelect"
                            label="Memory Quota (Gi)"
                            className="mb-3"
                        >
                        <Form.Control type="number" id="memQuota" placeholder="Enter Memory Quota" min="1" defaultValue="16" step="0.1" disabled={isGPUQuotaDisabled}/>
                        </FloatingLabel>
                    </Form.Group>
                    <Form.Group>
                        GPU Quota
                        <FloatingLabel
                            controlId="GPUQuota"
                            label="GPU Quota"
                            className="mb-3"
                        >
                            <Form.Control as="select" id="GPUQuota" disabled={isGPUQuotaDisabled} >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                            </Form.Control>
                        </FloatingLabel>
                    </Form.Group>
                    <Form.Group>
                        GPU Vendor
                        <FloatingLabel
                            label="GPU Vendor"
                            className="mb-3"
                        >
                            <Form.Control as="select" id="GPUVendor">
                                <option value="NVIDIA">NVIDIA</option>
                                <option value="AMD">AMD</option>
                            </Form.Control>
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
