import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import { Select, MenuItem } from '@mui/material';
function Lab() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]);
    const [outsideuser, setOutsideuser] = useState([]);
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
        response = await fetch('http://120.126.23.245:31190/api/ldap/outside/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab}),
        });
        data = await response.json();
        if(response.status===200){
            console.log(data);
            setOutsideuser(data);
        } else {
            alert("error");
        }
    }
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
    const handleOnclick = async() => {
        if(window.confirm("Are you sure to add this user?")){
            let username = document.getElementById("adduserlab").value;
            console.log(username);
            let response = await fetch("http://120.126.23.245:31190/api/ldap/lab/insert/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({'lab': state.lab, 'user': username})
            });
            if(response.status===200) {
                alert("Add sucessfully!!")
                window.location.href='/'
            } else {
                alert("error");
            }
        }
    }
    const handleOnclick_export = async() => {
        let response = await fetch("http://120.126.23.245:31190/api/ldap/lab/excel/export/", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },  
            body: JSON.stringify({'lab': state.lab})
        });
        if(response.status===200) {
            // get and download the response excel file
            const filename = 'data.xlsx'
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log(blob);

        } else {
            alert("something wrong");
        }
    }
    const handleOnclick_import = async() => {
        let response = await fetch("http://120.126.23.245:31190/api/ldap/lab/import/", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab})
        });
        if(response.status===200) {
            alert("Import sucessfully!!")
            window.location.href='/'
        } else {
            alert("error");
        }
    }

    return (
        <div>
            <h1 style={{fontFamily: "Comic Sans MS"}}>{labinfo ? labinfo.cn : null} Members  <ContactPageIcon fontSize='large'/></h1>
            <span style={{display: "flex", marginLeft: "5vh", color: "#DC3545"}}>*Click username can get user information</span><br/>
            <select id="adduserlab" style={{marginLeft: "2vh", borderRadius: "8px"}}>
                {outsideuser ? outsideuser.map((user, index) => (
                    <option value={user}>{user}</option>
                )) : null}
            </select>
            <Button variant="success" style={{marginLeft: "2vh"}} onClick={handleOnclick}>Add</Button>
            <Button variant="secondary" style={{marginLeft: "2vh"}} onClick={handleOnclick_export}>Export</Button>
            <Button variant="info" style={{marginLeft: "2vh"}}><Link to="import" state={{'lab': state.lab}}>Import</Link></Button>
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
