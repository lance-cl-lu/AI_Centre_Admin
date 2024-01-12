import Tree from 'react-animated-tree'
import { useContext, useEffect } from 'react';
import AuthContext from '../../context/AuthContext';
import { AuthProvider } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';
import "./Tree.css";
function TreeView() {
    let {userlist, getUserList} = useContext(AuthContext);
    useEffect(() => {
        getUserList();
    }, []);
    
    return (
        <div className='tree'>
            <AuthProvider>
                <Card>
                    <Card.Header>Group List</Card.Header>
                    <div className="TreeStyle" style={{fontFamily: "Segoe UI", padding: "10px", margin: "10px"}}>
                    {userlist && userlist.map((user, index) => (
                        <Tree content={<Link to="/lab" state={{ "lab": user.group_dn }} style={{textDecoration: 'none', color: "#242424"}} className="TreeStyle">{user.group_dn}</Link>} type="Group" key={index}>
                            {user.member_uids.map((memberUid, index) => (
                                <Tree content={<Link to="/user" state={{ "user": memberUid }} style={{textDecoration: 'none', color: "#242424"}}>{memberUid}</Link>} type="User" key={index}/>
                            ))}
                        </Tree>
                    ))}
                    </div>
                </Card>
            </AuthProvider>
        </div>
    );
}
export default TreeView;