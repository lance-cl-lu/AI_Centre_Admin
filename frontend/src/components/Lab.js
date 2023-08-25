import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import ContactPageIcon from '@mui/icons-material/ContactPage';
function Lab() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]); 
    useEffect(() => {
            labinfofetch();
    }, [state]);

    let labinfofetch = async() => {
        let response = await fetch('http://120.126.23.245:31190/api/ldap/lab/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab}),
        });
        let data = await response.json();
        if(response.status===200){
            console.log(data);
            setLabinfo(data);
        } else {
            console.log('error');
        }
    }
    console.log(state.lab)
    const deleteGroup = async() => {
        if(window.confirm("It will also delete all user in Lab, are you sure to do it?")){
            let response = await fetch("http://120.126.23.245:31190/api/ldap/lab/delete/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({'lab': state.lab})
            });
            if(response.status===200) {
                alert("Group delete sucessfully!!")
                window.location.href='/'
            }
        }
    }
    return (
        <div>
            <h1 style={{fontFamily: "Comic Sans MS"}}>{labinfo ? labinfo.cn : null} Members  <ContactPageIcon fontSize='large'/></h1>
            <span style={{display: "flex", marginLeft: "5vh", color: "#DC3545"}}>*Click username can get user information</span><br/>
            <Table striped bordered hover style={{borderWidth:"20px", boxShadow: "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px", borderRadius: "20px"}}>
                <div><th style={{height:"8vh", display: "inline-flex", width:"30%"}} >#</th>
                     <th style={{height:"8vh", display: "inline-flex", width:"30%"}} >Username</th>
                     <th style={{height:"8vh", display: "inline-flex", width:"30%"}}>permission</th>
                </div>
                    { labinfo && labinfo.memberUid ? Object.keys(labinfo.memberUid).map((memberUid, index) => (
                        <tr style={{height:"8vh"}}>
                            <td style={{height:"8vh", display: "inline-flex", width:"30%"}}>{index}</td>
                            <td style={{height:"8vh", display: "inline-flex", width:"30%"}}><Link to="/user" state={{ "user": memberUid }} style={{textDecoration:"none"}}>{memberUid}</Link></td>
                            <td style={{height:"8vh", display: "inline-flex", width:"30%"}}>{labinfo.memberUid[memberUid] === 'admin' ? <span style={{color: "#A020F0"}}>{labinfo.memberUid[memberUid]}</span>: <span>{labinfo.memberUid[memberUid]}</span>}</td>
                        </tr>
                    )) : null  
                    }

            <Button variant="danger" onClick={deleteGroup} style={{marginTop: "10px", marginBottom: "10px"}}>Delete group</Button>
            </Table>
        </div>
    );
}

export default Lab;
