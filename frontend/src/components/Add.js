import { Link } from "react-router-dom"
import "./Add.css"
import { Card } from "react-bootstrap"
import { useState } from "react"
import jwt_decode from "jwt-decode"
function Add() {
    const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)

    let matchedResult = /.*admin$/.test(permission);
    console.log(matchedResult)
    
    return (
        <div className="AddContent">
            { permission==='root' ? <Card className="AddType"><Card.Body><Link to="/add/lab" className="LinkStyle"><span>Add Labatory</span></Link></Card.Body></Card> : null }
            { matchedResult || permission==='root' ? <> <Card className="AddType"><Card.Body><Link to="/add/user" className="LinkStyle"><span>Add User</span></Link></Card.Body></Card> </>:
            null }
            { permission==='root' ? 
                <Card className="AddType"><Card.Body><Link to="/add/admin" className="LinkStyle"><span>Add Administrator</span></Link></Card.Body></Card> :
            null }
            { matchedResult || permission==='root' ? <>
                <Card className="AddType"><Card.Body><Link to="/add/excel" className="LinkStyle"><span>Import from excel</span></Link></Card.Body></Card>
                <Card className="AddType"><Card.Body><Link to="/export/excel" className="LinkStyle"><span>Export excel</span></Link></Card.Body></Card></> :
            null }
        </div>
    )
}
export default Add