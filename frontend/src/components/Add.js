import { Link } from "react-router-dom"
import "./Add.css"
import { Card } from "react-bootstrap"
import { useState } from "react"
import jwt_decode from "jwt-decode"
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import GroupsIcon from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TocIcon from '@mui/icons-material/Toc';
import DownloadingIcon from '@mui/icons-material/Downloading';
import { SERVICE_EXPORT} from './Urls';
import { Button } from "@chakra-ui/react";
function Add() {
    const [ permission ] = useState(() =>localStorage.getItem('authToken') ? jwt_decode(localStorage.getItem('authToken'))['permission'] : null)

    let matchedResult = /.*admin$/.test(permission);
    console.log(matchedResult)
    
    const downloadExcel = () => {
        fetch(SERVICE_EXPORT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'export.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        })
    }

    return (
        <div className="AddContent">
            { permission==='root' ? <Card className="AddType"><Card.Body><Link to="/add/lab" className="LinkStyle"><span>Add Group    <GroupsIcon fontSize='large'/></span></Link></Card.Body></Card> : null }
            { matchedResult || permission==='root' ? <> <Card className="AddType"><Card.Body><Link to="/add/user" className="LinkStyle" state={{"group":"null"}}><span>Add User    <AssignmentIndIcon fontSize='large'/></span></Link></Card.Body></Card> </>:
            null }
            { permission==='root' ? 
                <Card className="AddType"><Card.Body><Link to="/add/admin" className="LinkStyle"><span>Add Administrator   <AdminPanelSettingsIcon fontSize="large"/></span></Link></Card.Body></Card> :
            null }
            { permission==='root' ? <>
                <Card className="AddType"><Card.Body><Link to="/add/excel" className="LinkStyle"><span>Import from excel    <TocIcon fontSize="large"/></span></Link></Card.Body></Card>
                <Card className="AddType"><Card.Body><Link onClick={downloadExcel} className="LinkStyle"><span>Export excel    <DownloadingIcon fontSize="large"/></span></Link></Card.Body></Card></> :
            null }
        </div>
    )
}
export default Add
