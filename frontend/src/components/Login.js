import "./Login.css";
import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';


function Login() {

    let {loginUser} = useContext(AuthContext)
    // after login refresh the Dropdown component
    
    return (
        <div className="Login">
            <form onSubmit={loginUser} className="LoginForm">
            <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control type="text" placeholder="Please enter your username" name="username" className="LoginForm-input form-control" />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control type="text" placeholder="Please enter your password" name="password" className="LoginForm-input form-control" />
            </Form.Group>
            <Button type="submit" className="btn btn-primary-danger">Submit</Button>
            </form>
        </div>
    )
}
export default Login
