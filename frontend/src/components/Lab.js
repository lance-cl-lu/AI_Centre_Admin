import React from 'react';
import { useLocation, Link } from 'react-router-dom';

function Lab() {
    const location = useLocation();
    console.log(location);
    const state = location.state;
    return (
        <div>
            <h1>Lab</h1>
            <h2>{state && state.group_dn}</h2>
        </div>
    );
}

export default Lab;
