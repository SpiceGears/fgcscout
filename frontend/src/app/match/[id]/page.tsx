"use client";
import { useState } from "react";

export default function MatchOverview() {
    return (
        <div className="bg-gray-950 min-h-screen w-full">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-50">Match</h1>
                </div>

                <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-xl border border-gray-700 bg-gray-900 shadow-lg overflow-hidden w-fit">
                        <table className="text-left text-gray-200">
                            <thead>
                                <tr className="bg-gray-800">
                                    <th
                                        className="py-2 px-4 border-b border-gray-700 text-center"
                                        colSpan={3}
                                    >
                                        Teams
                                    </th>
                                    <th className="py-2 px-4 border-b border-gray-700">Scores</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-red-500/20">
                                    <td className="py-2 px-4 border-b border-gray-700">Team Poland</td>
                                    <td className="py-2 px-4 border-b border-gray-700">Team Canada</td>
                                    <td className="py-2 px-4 border-b border-gray-700">Team USA</td>
                                    <td className="py-2 px-4 border-b border-gray-700">129</td>
                                </tr>
                                <tr className="bg-blue-500/20">
                                    <td className="py-2 px-4">Team Germany</td>
                                    <td className="py-2 px-4">Team France</td>
                                    <td className="py-2 px-4">Team UK</td>
                                    <td className="py-2 px-4">98</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="space-y-4 sm:space-y-6 mt-6">
                    <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6">
                        <p className="text-lg sm:text-xl font-bold text-gray-100 mb-4">
                            Match Overview
                        </p>

                        <table className="w-full text-left text-gray-200">
                            <thead>
                                <tr>
                                    <th className="py-2 px-4 border-b border-gray-700 text-center w-[60%]"></th>
                                    <th className="py-2 px-4 bg-red-500 text-center">Red<br />124</th>
                                    <th className="py-2 px-4 bg-blue-500 text-center">Blue<br />94</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-700">
                                    <td className="py-2 px-4 border-b border-gray-700">Barriers</td>
                                    <td className="py-2 px-4 bg-red-500/20 text-center">2</td>
                                    <td className="py-2 px-4 bg-blue-500/20 text-center">2</td>
                                </tr>
                                <tr className="border-b border-gray-700">
                                    <td className="py-2 px-4 border-b border-gray-700">Biodiversity Units</td>
                                    <td className="py-2 px-4 bg-red-500/20 text-center">34</td>
                                    <td className="py-2 px-4 bg-blue-500/20 text-center">28</td>

                                </tr>
                                <tr className="border-b border-gray-700">
                                    <td className="py-2 px-4 border-b border-gray-700">Distribution Factor</td>
                                    <td className="py-2 px-4 bg-red-500/20 text-center">1.0</td>
                                    <td className="py-2 px-4 bg-blue-500/20 text-center">1.0</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-4">Coopertition Bonus</td>
                                    <td className="py-2 px-4 bg-red-500/20 text-center">15</td>
                                    <td className="py-2 px-4 bg-blue-500/20 text-center">15</td>
                                    
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}