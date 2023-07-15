import { Link } from 'react-router-dom';
import './Infolist.css';
import { useState, useEffect } from 'react';
function Infolist() {
    const [ldapinfo, setLdapinfo] = useState([]);

    useEffect(() => {
        ldapgroupuser();
    }, []);

    let ldapgroupuser = async(e )=> {
        let response = await fetch('http://127.0.0.1:8000/api/ldap/info/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        let data = await response.json();
        if(response.status===200){
            console.log(data);
            setLdapinfo(data);
        } else {
            console.log('error');
        }
    }
    /* map the following json data in ldapinfo into the list
            [
        {
            "group_dn": "ccllab",
            "member_uids": [
            "minghsuan",
            "user02"
            ]
        },
        {
            "group_dn": "yanglab",
            "member_uids": [
            "minghsuan"
            ]
        }
        ]
    */
    return ( 
        <div className="infolist">
            <ul className='info-ul'>
                <li className='ul-li'><Link to ="/">Dashboard</Link></li>
                <ul>
                    {ldapinfo.map((item, index) => (
                        <li className='ul-li' key={index}>
                            <Link to="/lab" state={{"lab":item.group_dn}}>
                                {item.group_dn}
                            </Link>
                            <ul>
                            {item.member_uids.map((memberUid, index) => (
                                <li className='ul-li' key={index}>
                                <Link to="/user" state={{"user":memberUid}}>{memberUid}</Link>
                                </li>
                            ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            </ul>
        </div>
    );
}

export default Infolist;