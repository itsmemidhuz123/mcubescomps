'use client';

import React, { Component } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-red-800 w-full max-w-lg">
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
              <p className="text-zinc-400 mb-4">
                An error occurred while loading the battle. Please try again.
              </p>
              {this.state.error && (
                <p className="text-sm text-zinc-500 mb-4 bg-zinc-800 p-2 rounded">
                  {this.state.error.message || 'Unknown error'}
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <Button onClick={this.handleReset} variant="outline">
                  Try Again
                </Button>
                <Button onClick={() => window.location.href = '/battle'}>
                  Go to Battle Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
