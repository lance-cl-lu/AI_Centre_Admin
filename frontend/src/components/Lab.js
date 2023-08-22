import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import useContext from 'react';
import { Button, Table } from 'react-bootstrap';

function Lab() {
    const location = useLocation();
    const state = location.state;
    // fetch data from backend
    const [labinfo, setLabinfo] = useState([]); 
    useEffect(() => {
            labinfofetch();
    }, [state]);

    let labinfofetch = async() => {
        let response = await fetch('http://127.0.0.1:8000/api/ldap/lab/', {
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
            let response = await fetch("http://127.0.0.1:8000/api/ldap/lab/delete/", {
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
            <h1>{labinfo ? labinfo.cn : null} Lab Members</h1><br/>
            <Table  striped bordered hover>
                <th style={{height:"8vh"}}>Username</th>
                    {labinfo && labinfo.memberUid ? labinfo.memberUid.map((memberUid, index) => (
                        <tr style={{height:"8vh"}}>
                            <Link to="/user" state={{ "user": memberUid }}>{memberUid}</Link>
                        </tr>
                    )) : null}
                <br/>
            </Table>
            <Button onClick={deleteGroup}>Delete group</Button>
        </div>
    );
}

export default Lab;
