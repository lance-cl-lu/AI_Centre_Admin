import React, { useEffect, useState } from 'react';
import { Form} from 'react-bootstrap';
import { List, ListItem } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import Button from 'react-bootstrap/Button';

// sweetalert2
import Swal from 'sweetalert2';
function Insert() {
    const state = useLocation().state;
    let [outsideuser, setOutsideuser] = useState([]);
    let [reg_user, setReg_user] = useState([]);
    const [inputValue, setInputValue] = useState('');
    // State to track the selected option
    const [selectedOption, setSelectedOption] = useState('');
    useEffect(() => {
        let getuserinfo = async () => {
            let response = await fetch('/api/ldap/outside/user/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "lab": state.group,
                }),
            })
            let data = await response.json();
            if(response.status===200){
                console.log(data);
                setOutsideuser(data);
                setReg_user(data);
            } else {
                console.log('error');
            }
        }
        getuserinfo();

    }, [state]);
    // get the inpute text box value if it change and use it value to regualr expression to simliair the user in outsideuser
    const handleInputChange = (event) => {
        setInputValue(event.target.value);
        const filter = new RegExp(event.target.value, 'i');
        const result = outsideuser.filter(user => filter.test(user));
        console.log(result);
        setReg_user(result);
    };

    const handleSubmit = async () => {
        let username = document.getElementById("adduserlab").value;
        console.log(document.getElementById("admin").checked);
        console.log(username);
        let response = await fetch("/api/ldap/lab/insert/", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.group, 'user': username, 'admin': document.getElementById("admin").checked})
        });
        if(response.status===200) {
            Swal.fire({
                title: 'Add success',
                text: 'The user has been added to the group',
                icon: 'success',
                timer: 2000,
            });
            // privious page
            setTimeout(() => {
                window.history.back();
            }, 2000);
        } else {
            Swal.fire({
                title: 'Add fail',
                text: 'The user has been added to the group',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }


    return (
        <div>
            <h1 style={{fontSize:"36px", fontFamily:"Open Sans", fontWeight:"bold"}}>Insert an existed user to {state.group}</h1>
            <br/>
            {/* use a inpute text box to re the option and add all user from outsideuser to selection's opsion */}
                <Form className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px"}}>
                    <Form.Group className="mb-3" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'baseline', margin: '20px 0px'}}>
                        <Form.Label>Search User</Form.Label>
                        <Form.Control type="text" placeholder="Search User" onChange={handleInputChange} value={inputValue} style={{border: '1px solid #ced4da', borderRadius: '12px', width: '40%', height: '38px'}}/>
                        <Form.Select aria-label="Default select example" id="adduserlab" style={{border: '1px solid #ced4da', borderRadius: '12px', width: '40%', height: '38px'}}>
                            <option>Choose an user</option>
                            {reg_user.map((user, index) => (
                                index === 0 ? <option value={user} selected>{user}</option> : <option value={user}>{user}</option>
                            ))}
                        </Form.Select>
                        <Form.Check type="checkbox" label="Admin" style={{margin: '0px 20px'}} id='admin' />
                        <button type="button" class="btn btn-primary" style={{margin: "1rem"}} onClick={handleSubmit}>Submit</button>
                    </Form.Group>
                    <div>
                        <p>User Filter: <List>
                            {reg_user.length > 10 ? reg_user.slice(0, 10).map((user, index) => (
                                <ListItem key={index}>
                                    {user}
                                </ListItem>
                            )) : reg_user.map((user, index) => (
                                <ListItem key={index}>
                                    {user}
                                </ListItem>
                            ))}
                            {reg_user.length > 10 ? <ListItem>...</ListItem> : null}
                        </List></p>
                    </div>                
            </Form>
            <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
        </div>
    );
}

export default Insert;
