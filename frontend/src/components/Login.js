import "./Login.css";
import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
function Login() {
    let {loginUser} = useContext(AuthContext)    
    return (
        <div className="Login">
                <form onSubmit={loginUser} className="LoginForm">
                <img src="https://aic.cgu.edu.tw/var/file/44/1044/msys_1044_4886051_59674.png" alt="CUG AI Centre" className="login-img"/><br/>
                <h2>Login</h2><br/>
                <Form.Group className="mb-3">
                    <Form.Label>Username <ContactEmergencyIcon/></Form.Label>
                    <Form.Control type="text" placeholder="Enter username" name="username" className="LoginForm-input form-control" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Password  <VpnKeyIcon/></Form.Label>
                    <Form.Control type="password" placeholder="Enter password" name="password" className="LoginForm-input form-control" />
                </Form.Group>
                <br/>
                <Button type="submit" className="btn btn-primary-danger login-btn">Submit</Button>
                </form>
        </div>
    )
}
export default Login
