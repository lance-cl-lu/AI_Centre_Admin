import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import { Checkbox, Container } from '@mui/material';
import { SERVICE_IP, SERVICE_PORT} from './Urls';
function Lab() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]);
    const [outsideuser, setOutsideuser] = useState([]);
    const [sortIncline, setSortinliece] = useState(true);
    const [CheckAll, setCheckAll] = useState(false);
    useEffect(() => {
            labinfofetch();
    }, [state]);


    let labinfofetch = async() => {
        let response = await fetch('http://' + SERVICE_IP + ':' + SERVICE_PORT + '/api/ldap/lab/', {
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
    const deleteGroup = async() => {
        if(window.confirm("It will also delete all user in Lab, are you sure to do it?")){
            let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/delete/", {
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
            let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/insert/", {
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
        let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/excel/export/", {
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
        let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/import/", {
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
    const handleSort = async() => {
        // sort the memberUid
        if(sortIncline) {
            setLabinfo((prev) => {
                let newlabinfo = {...prev};
                newlabinfo.memberUid = Object.keys(newlabinfo.memberUid)
                .sort((a, b) => {
                    if(a < b) {
                        return -1;
                    }
                    if(a > b) {
                        return 1;
                    }
                    return 0;
                })
                .reduce((acc, key) => {
                    acc[key] = newlabinfo.memberUid[key];
                    return acc;
                }, {});

                console.log(newlabinfo.memberUid);
                return newlabinfo;
            })
            setSortinliece(false);
            document.getElementById("buttonSort").innerHTML = "Sort with descending";
        } else {
            let newlabinfo = {...labinfo};
            newlabinfo.memberUid = Object.keys(newlabinfo.memberUid)
            .sort((a, b) => {
                if(a < b) {
                    return 1;
                }
                if(a > b) {
                    return -1;
                }
                return 0;
            })
            .reduce((acc, key) => {
                acc[key] = newlabinfo.memberUid[key];
                return acc;
            }
            , {});
            setLabinfo(newlabinfo);
            setSortinliece(true);
            document.getElementById("buttonSort").innerHTML = "Sort with ascending";
        }
    }
    const handleOnclick_mutiple_delete = async() => {
        if(window.confirm("Are you sure to delete these users?")){
            let checkboxes = document.getElementsByName('checkbox');
            let usernames = [];
            for(let i=0; i<checkboxes.length; i++) {
                if(checkboxes[i].checked) {
                    usernames.push(checkboxes[i].parentNode.parentNode.childNodes[1].childNodes[0].innerHTML);
                }
            }
            if(usernames.length===0) {
                alert("Please select at least one user");
                return;
            }
            console.log(usernames);
            let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/user/mutiple/delete/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                // if checkbox is checked, then add the username to the body
                body: JSON.stringify({"users": usernames})
            });
            if(response.status===200) {
                alert("Delete sucessfully!!")
                window.location.href='/'
            } else {
                // alert the respone error message
                let data = await response.json();
                alert(data.message);
            }
        }
    }
    const handleOnclick_mutiple_remove = async() => {
        if(window.confirm("Are you want to remove these user from this group??")) {
            let checkboxes = document.getElementsByName('checkbox');
            let usernames = [];
            for(let i=0; i<checkboxes.length; i++) {
                if(checkboxes[i].checked) {
                    usernames.push(checkboxes[i].parentNode.parentNode.childNodes[1].childNodes[0].innerHTML);
                }
            }
            if(usernames.length===0) {
                alert("Please select at least one user");
                return;
            }
            console.log(usernames);
            let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/mutiple/remove/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                // if checkbox is checked, then add the username to the body
                body: JSON.stringify({"group": state.lab, "users": usernames})
            });
            if(response.status===200) {
                alert("Remove sucessfully!!")
                window.location.href='/'
            } else {
                let respone = await response.json();
                alert(respone.message);
            }

        }

    }
    // if 
    const handleCheckAllChange = (event) => {
        if(event.target.checked) {
            console.log("check all");
            setCheckAll(true);
            let checkboxes = document.getElementsByName('checkbox');
            for(let i=0; i<checkboxes.length; i++) {
                checkboxes[i].checked = true;
            }
        } else {
            setCheckAll(false);
            let checkboxes = document.getElementsByName('checkbox');
            for(let i=0; i<checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
        }
    }



    return (
        <div>
                <h1 style={{fontFamily: "Comic Sans MS"}}>{labinfo ? labinfo.labname : null} Members  <ContactPageIcon fontSize='large'/></h1>
            <br/>
            <Container style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <span style={{fontFamily: "Comic Sans MS", fontSize:"20px", color:"orange"}}># of group members: {labinfo ? labinfo.memberUid ? Object.keys(labinfo.memberUid).length : 0 : null}</span>
                {/*<select id="adduserlab" style={{marginLeft: "2vh", borderRadius: "8px"}}>
                    {outsideuser ? outsideuser.map((user, index) => (
                        <option value={user}>{user}</option>
                    )) : null}
                </select>*/}
                <Link to="/insert" state={{'group': state.lab}} style={{textDecoration: 'none', color: "#FFFFFF", marginLeft: "2vh"}}><Button style={{ backgroundColor:"navy"}}>Add existed user</Button></Link>
                <Link to="/add/user" style={{textDecoration: 'none', color: "#FFFFFF",marginLeft: "2vh"}} state={{"group": state.lab}}><Button style={{ backgroundColor: "purple"}}>Add new user</Button></Link>
                {/* <Button variant="success" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_remove}>Mutiple Remove</Button> */}
                <Button variant="danger" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_delete}>Mutiple Delete</Button> 
                <Button variant="secondary" style={{marginLeft: "2vh"}} onClick={handleOnclick_export}>Export Group</Button>
                <Link to="import" state={{'lab': state.lab}} style={{marginLeft: "2vh", textDecoration: 'none', color: "#FFFFFF"}}><Button variant="info" >Import Group</Button></Link>
                <Button variant='success' style={{marginLeft: "2vh"}} onClick={handleSort} id="buttonSort">Sort with ascending</Button>
            </Container>
            <br/>
            <Table striped bordered hover style={{borderWidth:"20px", boxShadow: "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px", borderRadius: "20px"}}>
                <div style={{ justifyContent: "center"}}>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} ><input type="checkbox" style={{width:"20px", height:"12px", display: "inline-flex", justifyContent: "center", alignItems: "center", cursor: "pointer"}} id="checkAll" onChange={handleCheckAllChange} /></th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} >Username</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>permission</th>
                    {/*<th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Remove</th>*/}
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Edit</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Delete</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Change password</th>
                </div>
                    { labinfo && labinfo.memberUid ? Object.keys(labinfo.memberUid).map((memberUid, index) => (
                        <tr>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><input type="checkbox" style={{width:"20px", height:"12px"}} name="checkbox" /></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><Link to="/user" state={{ "user": memberUid }} style={{textDecoration:"none"}}>{memberUid}</Link></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>{labinfo.memberUid[memberUid] === 'admin' ? <span style={{color: "#A020F0"}}>{labinfo.memberUid[memberUid]}</span>: <span>{labinfo.memberUid[memberUid]}</span>}</td>
                            {/*<td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%"}}><Button style={{ backgroundColor: "Gold", color: "#242424"}} onClick={
                                async() => {
                                    if(window.confirm("Are you sure to remove this user from this lab?")){
                                        let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/lab/remove/", {
                                            method: "POST",
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({'lab': state.lab, 'user': memberUid})
                                        });
                                        if(response.status===200) {
                                            alert("Remove sucessfully!!")
                                            window.location.href='/'
                                        } else {
                                            alert("error");
                                        }
                                    }
                                }
                            }>Remove</Button></div></td>*/}
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%"}}><Button variant="secondary"><Link to="/user" state={{"user": memberUid}} style={{textDecoration: "none", color:"#FFFFFF", height: "100%", width: "100%"}} >Edit</Link></Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%"}}><Button variant="danger" onClick={  
                                async() => {
                                    if(window.confirm("Are you sure to delete this user?")){
                                        let response = await fetch("http://" + SERVICE_IP + ":" + SERVICE_PORT + "/api/ldap/user/delete/", {
                                            method: "POST",
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({'username': memberUid})
                                        });
                                        if(response.status===200) {
                                            alert("Delete sucessfully!!")
                                            window.location.href='/'
                                        } else {
                                            alert("error");
                                        }
                                    }
                                }
                            } >Delete</Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%"}}><Button variant="info"><Link to="/password" style={{textDecoration: "none", color: "#FFFFFF"}} state={{"user": memberUid}}>Change Password</Link></Button></div></td>
                        </tr>
                    )) : null  
                    }
            <br/>
            <Button variant="danger" onClick={deleteGroup} style={{marginTop: "20px", marginBottom: "10px"}}>Delete group</Button>
            </Table>
        </div>
    );
}

export default Lab;
