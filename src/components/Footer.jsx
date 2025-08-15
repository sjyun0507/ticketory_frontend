// Footer.js
import React from 'react';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Ticketory. All rights reserved.</p>
            <p className="footer-tagline">Your movie journey starts here.</p>
        </footer>
    );
};

export default Footer;