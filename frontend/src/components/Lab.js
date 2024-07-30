import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { Button, Table } from 'react-bootstrap';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import { Container, Box, Text } from '@chakra-ui/react';
import Swal from 'sweetalert2'

function Lab() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]);
    const [sortIncline, setSortinliece] = useState(true);
    const [CheckAll, setCheckAll] = useState(false);
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
            console.log(data);
            setLabinfo(data);
        } else {
            console.log('error');
        }

    }
    const deleteGroup = async() => {
        const swalWithBootstrapButtons = Swal.mixin({
            customClass: {
              confirmButton: "btn btn-success alert-btn",
              cancelButton: "btn btn-danger alert-btn"
            },
            buttonsStyling: false
          });
          swalWithBootstrapButtons.fire({
            title: "Are you sure to delete this group?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete it!",
            cancelButtonText: "No, cancel!",
            reverseButtons: true
          }).then((result) => {
            if (result.isConfirmed) {
                //async()
                fetch("/api/ldap/lab/delete/", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({'lab': state.lab})
                }).then((response) => {
                    if(response.status===200) {
                        Swal.fire({
                            title: "Deleted!",
                            text: "Your group has been deleted.",
                            icon: "success"
                        });
                        setTimeout(() => {
                            window.location.href='/'
                        }, 1000);   
                    } else {
                        Swal.fire({
                            title: "Error!",
                            text: "Something wrong",
                            icon: "error"
                        });
                    }
                });
            } else if (
              /* Read more about handling dismissals below */
              result.dismiss === Swal.DismissReason.cancel
            ) {
              swalWithBootstrapButtons.fire({
                title: "Cancelled",
                text: "Your imaginary file is safe :)",
                icon: "error"
              });
            }
          });
    }

    const handleOnclick_export = async() => {
        let response = await fetch("/api/ldap/lab/excel/export/", {
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
            let response = await fetch("/api/ldap/user/mutiple/delete/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                // if checkbox is checked, then add the username to the body
                body: JSON.stringify({"users": usernames})
            });
            if(response.status===200) {
                Swal.fire({
                    title: 'Delete success',
                    text: 'These users have been deleted',
                    icon: 'success',
                    timer: 2000,
                });
                setTimeout(() => {
                    window.location.href='/'
                }, 2000);
            } else {
                // alert the respone error message
                let data = await response.json();
                Swal.fire({
                    title: 'Delete fail',
                    text: data.message,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
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
            let response = await fetch("/api/ldap/lab/mutiple/remove/", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                // if checkbox is checked, then add the username to the body
                body: JSON.stringify({"group": state.lab, "users": usernames})
            });
            if(response.status===200) {
                Swal.fire({
                    title: 'Remove success',
                    text: 'These users have been removed from the group',
                    icon: 'success',
                    timer: 2000,
                });
                // privious page
                setTimeout(() => {
                    window.history.back();
                }, 2000);
            } else {
                let respone = await response.json();
                Swal.fire({
                    title: 'Remove fail',
                    text: respone.message,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }

        }

    }
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
            <Container style={{display: "flex", justifyContent: "space-evenly", alignItems: "center"}}>
                <div style={{ flex: "0 0 20%", padding: "10px" }}>
                    <Text style={{fontFamily: "Comic Sans MS", fontSize:"20px", color:"orange"}}># of group members: {labinfo ? labinfo.memberUid ? Object.keys(labinfo.memberUid).length : 0 : null}</Text>
                </div>
                <div style={{ flex: "0 0 80%", padding: "10px", display: "flex" }}>
                    <Link to="/insert" state={{'group': state.lab}} style={{textDecoration: 'none', color: "#FFFFFF", marginLeft: "2vh", backgroundColor: "navy",}} class="btn btn-primary"><Button style={{ backgroundColor:"navy"}}>Add existed user</Button></Link>
                    <Link to="/add/user" style={{textDecoration: 'none', color: "#FFFFFF",marginLeft: "2vh", backgroundColor: "purple"}} state={{"group": state.lab}} class="btn btn-primary"><Button style={{ backgroundColor: "purple"}}>Add new user</Button></Link>
                    <Button variant="success" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_remove}>Mutiple Remove</Button>
                    <Button variant="danger" style={{marginLeft: "2vh"}} onClick={handleOnclick_mutiple_delete}>Mutiple Delete</Button> 
                    <Button variant="secondary" style={{marginLeft: "2vh"}} onClick={handleOnclick_export}>Export Group</Button>
                    <Link class="btn btn-info" to="import" state={{'lab': state.lab}} style={{marginLeft: "2vh", textDecoration: 'none', color: "#FFFFFF"}}><Button variant="info" color='rgb(255, 255, 255);' >Import Group</Button></Link>
                    <Button variant='success' style={{marginLeft: "2vh"}} onClick={handleSort} id="buttonSort">Sort with ascending</Button>
                    <Link to="/edit/group" state={{'lab': state.lab}} style={{marginLeft: "2vh", textDecoration: 'none', color: "#FFFFFF"}} class="btn btn-warning"><Button variant="warning">Edit Group</Button></Link>
                </div>
            </Container>
            <br/>
            <Table striped bordered hover style={{borderWidth:"20px", boxShadow: "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px", borderRadius: "20px"}}>
                <Box style={{ display: "flex" }}>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} ><input type="checkbox" style={{width:"20px", height:"12px", display: "inline-flex", justifyContent: "center", alignItems: "center", cursor: "pointer"}} id="checkAll" onChange={handleCheckAllChange} /></th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}} >Username</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>permission</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Remove</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Edit</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Delete</th>
                    <th style={{height:"9vh", display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>Change password</th>
                </Box>
                    { labinfo && labinfo.memberUid ? Object.keys(labinfo.memberUid).map((memberUid, index) => (
                        <tr>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><input type="checkbox" style={{width:"20px", height:"12px"}} name="checkbox" /></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><Link to="/user" state={{ "user": memberUid }} style={{textDecoration:"none", border: "none"}}>{memberUid}</Link></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}>{labinfo.memberUid[memberUid] === 'admin' ? <span style={{color: "#A020F0", border: "none"}}>{labinfo.memberUid[memberUid]}</span>: <span>{labinfo.memberUid[memberUid]}</span>}</td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button style={{ backgroundColor: "Gold", color: "#242424"}} onClick={
                                async() => {
                                    if(window.confirm("Are you sure to remove this user from this lab?")){
                                        let response = await fetch("/api/ldap/lab/remove/", {
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
                            }>Remove</Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button variant="secondary"><Link to="/user" state={{"user": memberUid}} style={{textDecoration: "none", color:"#FFFFFF", height: "100%", width: "100%"}} >Edit</Link></Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none"}}><Button variant="danger" onClick={  
                                async() => {
                                    const swalWithBootstrapButtons = Swal.mixin({
                                        customClass: {
                                          confirmButton: "btn btn-danger alert-btn",
                                          cancelButton: "btn btn-warning alert-btn"
                                        },
                                        buttonsStyling: false
                                      });
                                      swalWithBootstrapButtons.fire({
                                        title: "Are you sure to delete this user?",
                                        text: "You won't be able to revert this! All the user's data(including Notebooks, images...etc.) will be deleted",
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonText: "Yes, delete it!",
                                        cancelButtonText: "No, cancel!",
                                        reverseButtons: true
                                      }).then((result) => {
                                        if (result.isConfirmed) {
                                            fetch("/api/ldap/user/delete/", {
                                                method: "POST",
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({'username': memberUid})
                                            }).then((response) => {
                                                if(response.status===200) {
                                                    Swal.fire({
                                                        title: "Deleted!",
                                                        text: "Your user has been deleted.",
                                                        timer: 2000,
                                                        timerProgressBar: true,
                                                        icon: "success"
                                                    });

                                                } else {
                                                    Swal.fire({
                                                        title: "Error!",
                                                        text: "Something wrong",
                                                        icon: "error"
                                                    });
                                                }
                                                setTimeout(() => {
                                                    window.location.reload();
                                                }, 1000);
                                            });
                                        } else if (
                                          /* Read more about handling dismissals below */
                                          result.dismiss === Swal.DismissReason.cancel
                                        ) {
                                          swalWithBootstrapButtons.fire({
                                            title: "Cancelled",
                                            text: "Your imaginary file is safe :)",
                                            icon: "error"
                                          });
                                        }
                                      });
                                }
                            } >Delete</Button></div></td>
                            <td style={{height:"8vh",display: "inline-flex", width:"10vw", justifyContent: "center", alignItems: "center"}}><div style={{height:"80%", border: "none", display: "grid"}}><Button variant="info"><Link to="/password" style={{textDecoration: "none", color: "#FFFFFF"}} state={{"user": memberUid}}>Change Password</Link></Button></div></td>
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
