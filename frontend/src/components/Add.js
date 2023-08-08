import { Link } from "react-router-dom"
import "./Add.css"
import { Card } from "react-bootstrap"
import { useState } from "react"
import jwt_decode from "jwt-decode"
function Add() {
    const [permission, setPermission] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)
    console.log(permission)
    return (
        <div className="AddContent">
            <Card className="AddType"><Card.Body><Link to="/add/lab" className="LinkStyle"><span>Add Labatory</span></Link></Card.Body></Card>
            <Card className="AddType"><Card.Body><Link to="/add/user" className="LinkStyle"><span>Add User</span></Link></Card.Body></Card>
            <Card className="AddType"><Card.Body><Link to="/add/admin" className="LinkStyle"><span>Add Administrator</span></Link></Card.Body></Card>
            <Card className="AddType"><Card.Body><Link to="/add/excel" className="LinkStyle"><span>Import from Excel</span></Link></Card.Body></Card>
        </div>
    )
}
export default Add