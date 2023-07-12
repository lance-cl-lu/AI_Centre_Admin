import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';

function Lab() {
    const location = useLocation();
    console.log(location);
    const state = location.state;

    // fetch data from backend
    const [labinfo, setLabinfo] = useState([]); 

    useEffect(() => {
        const fetchData = async () => {
            const response = await fetch('http://127.0.0.1:8000/api/ldap/lab/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({'lab': state.group_dn}),
            });
            const data = await response.json();
            setLabinfo(data);
        };
        if(labinfo.cn!==state.group_cn) {
            fetchData();
            state.group_cn = labinfo.cn;
        }
    }, [labinfo, state]); // only run once

    



    return (
        <div>
            <form>
                <h1>This is {labinfo ? labinfo.cn : null} </h1><br/>
                <label>Lab Description</label>
                <input type="text" name="gidNumber" value={labinfo ? labinfo.gidNumber:null} readOnly/><br/>
                <h1>Lab Members</h1>
                 <ul>
                    {labinfo && labinfo.memberUid ? labinfo.memberUid.map((memberUid, index) => (
                        <li className='ul-li' key={index}>
                            <Link to="/user" state={{ "user": memberUid }}>{memberUid}</Link>
                        </li>
                    )) : null}
                    <br/>
                </ul>
            </form>
        </div>
    );
}

export default Lab;
