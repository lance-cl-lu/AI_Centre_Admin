import "./Login.css";
import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import Home from "./Home";

function Login() {

    let {loginUser} = useContext(AuthContext)
    // after login refresh the Dropdown component
    
    return (
        <div className="Login">
            <div className="LoginDiv">
            <form onSubmit={loginUser} className="LoginForm">
                <label>Username: </label><input type="text" placeholder="Please enter your username" name="username" className="LoginForm-input" /><br/>
                <label>Password: </label><input type="text" placeholder="Please enter your password" name="password" className="LoginForm-input" /><br/>
                <input type="submit" className="LoginForm-button"/>
            </form>
            </div>
        </div>
    )
}
export default Login
