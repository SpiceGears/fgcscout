"use client";
import { useState } from "react";

export default function MatchOverview() {
  return (
    <div className="bg-gray-950 min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-50">Match</h1>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-xl border border-gray-700 bg-gray-900 shadow-lg overflow-hidden">
            <table className="w-full table-auto text-left text-gray-200">
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
                <tr>
                  <td className="py-2 px-4 border-b border-gray-700 bg-red-500/20">
                    Team Poland
                  </td>
                  <td className="py-2 px-4 border-b border-gray-700 bg-red-500/20">
                    Team Canada
                  </td>
                  <td className="py-2 px-4 border-b border-gray-700 bg-red-500/20">
                    Team USA
                  </td>
                  <td className="py-2 px-4 border-b border-gray-700 bg-red-500/40">129</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 bg-blue-500/20">Team Germany</td>
                  <td className="py-2 px-4 bg-blue-500/20">Team France</td>
                  <td className="py-2 px-4 bg-blue-500/20">Team UK</td>
                  <td className="py-2 px-4 border-l border-gray-700 bg-blue-500/40">98</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-600 rounded-lg shadow-lg p-4 sm:p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-50">
            Detailed Results
          </h2>
          <table className="w-full text-left text-gray-200 border-collapse">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b border-gray-700 w-[60%]">
                  Global Objectives
                </th>
                <th
                  className="py-2 px-4 bg-green-500 text-center"
                  colSpan={2}
                >
                  Global Alliance
                  <br />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-4 border-b border-gray-700">
                  Barriers mitigated
                </td>
                <td className="py-2 px-4 bg-green-500/20 text-center" colSpan={2}>
                  2
                </td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-4 border-b border-gray-700">
                  Biodiversity Units scored
                </td>
                <td className="py-2 px-4 bg-green-500/20 text-center" colSpan={2}>
                  2
                </td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-4 border-b border-gray-700">
                  Distribution Factor
                </td>
                <td className="py-2 px-4 bg-green-500/20 text-center" colSpan={2}>
                  34
                </td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-4 border-b border-gray-700">
                  Coopertition Bonus
                </td>
                <td className="py-2 px-4 bg-green-500/20 text-center" colSpan={2}>
                  15
                </td>
              </tr>

              <tr className="border-b border-gray-700">
                <th className="py-2 px-4 border-t border-b border-gray-700 w-[60%]">
                  Regional Objectives
                </th>
                <th className="py-2 px-4 border-t border-b border-gray-700 bg-red-500 text-center">
                  Red Alliance
                  <br />
                </th>
                <th className="py-2 px-4 border-t border-b border-gray-700 bg-blue-500 text-center">
                  Blue Alliance
                  <br />
                </th>
              </tr>

              <tr className="border-b border-gray-700">
                <td className="py-2 px-4 border-b border-gray-700">
                  Protection Multiplier
                </td>
                <td className="py-2 px-4 bg-red-500/20 text-center">3</td>
                <td className="py-2 px-4 bg-blue-500/20 text-center">1</td>
              </tr>
            </tbody>
          </table>
        </div>
        <iframe
          src="https://www.youtube.com/embed/JSj2kLV7HUI"
          title="Match"
          className="w-200 h-150 border border-gray-700 rounded-lg mt-4"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}