import Tree from 'react-animated-tree'
import { useContext, useEffect, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { AuthProvider } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
function TreeView() {
    let {userlist, getUserList, setinfolistChecker} = useContext(AuthContext);
    useEffect(() => {
        getUserList();
        setinfolistChecker = true;
    }, [setinfolistChecker]);
    
    return (
        <div className='tree'>
            <AuthProvider>
                <Tree content={<Link to="/">Dashbord</Link>}/>
                    {userlist && userlist.map((user, index) => (
                        <Tree content={<Link to="/lab" state={{ "lab": user.group_dn }}>{user.group_dn}</Link>} type="Lab" key={index}>
                            {user.member_uids.map((memberUid, index) => (
                                <Tree content={<Link to="/user" state={{ "user": memberUid }}>{memberUid}</Link>} type="User" key={index}/>
                            ))}
                        </Tree>
                    ))}
            </AuthProvider>
        </div>
    );
}
export default TreeView;