import React, { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import Swal from 'sweetalert2'
import { Button, Form } from "react-bootstrap";

function EditGroup() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]);
    useEffect(() => {
            labinfofetch();
    }, [state]);
    let labinfofetch = async() => {
        let response = await fetch('/api/ldap/lab/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab}),
        });
        let data = await response.json();
        if(response.status===200){
            console.log("labinfo", data);
            setLabinfo(data);
        } else {
            console.log('error');
        }
    }

    let editLab = async() => {
        let response = await fetch('/api/ldap/lab/edit/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab,
                'cpu_quota': document.getElementById('cpu_quota').value,
                'mem_quota': document.getElementById('memory_quota').value,
                'gpu_quota': document.getElementById('gpu_quota').value,
                'gpu_vendor': document.getElementById('gpu_vendor').value
            }),
        });
        if(response.status===200){
            Swal.fire({
                title: 'Success',
                text: 'Lab settings updated successfully',
                icon: 'success',
                confirmButtonText: 'Ok',
                timer: 1000,
            })
            // go to privious page
            setTimeout(() => {
                window.history.back();
            }, 2000);
        } else {
            console.log('error');
            Swal.fire({
                title: 'Error',
                text: 'Lab settings not updated',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
        }
    }

    return (
        <div>
            <h1 style={{fontFamily: "Comic Sans MS"}}>Edit Group {labinfo ? " "+labinfo.labname : null} <ContactPageIcon fontSize='large'/></h1>
            <br/>
            <Form style={{fontFamily: "Comic Sans MS"}}>
                 <Form.Group className="mb-3" controlId="formCPUQuota">
                    <Form.Label>CPU Quota</Form.Label>
                    <Form.Control type="number" id="cpu_quota" placeholder={labinfo.cpuQuota} defaultValue={labinfo.cpuQuota}/>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formMemoryQuota">
                    <Form.Label>Memory Quota</Form.Label>
                    <Form.Control type="number" id="memory_quota" placeholder={labinfo.memQuota} defaultValue={labinfo.memQuota}/>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formGPUQuota">
                    <Form.Label>GPU Quota</Form.Label>
                    <Form.Control as="select" id="gpu_quota" defaultValue={labinfo.gpuQuota}>
                        <option value={labinfo.gpuQuota}>{labinfo.gpuQuota}</option>
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                    </Form.Control>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formGPUVendor">
                    <Form.Label>GPU Vendor</Form.Label>
                    <Form.Control as="select" id="gpu_vendor" defaultValue={labinfo.gpuVendor}>
                        <option value="NVIDIA">nvidia</option>
                        <option value="AMD">amd</option>
                    </Form.Control>
                </Form.Group> 
            </Form>
            <Button variant="primary" type="button" onClick={editLab}>
                Change group default settings
            </Button>
        </div>
    );
}

export default EditGroup;
