import "./Login.css";
import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import Home from "./Home";

function Login() {

    let {loginUser} = useContext(AuthContext)

    return (
        <div className="LoginForm">
            <Home/>
            <form onSubmit={loginUser}>
                <label>Username: </label><input type="text" placeholder="Please enter your username" name="username" /><br/>
                <label>Password: </label><input type="text" placeholder="Please enter your password" name="password" /><br/>
                <input type="submit"/>
            </form>
        </div>
    )
}
export default Login
